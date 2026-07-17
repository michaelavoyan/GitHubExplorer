package com.githubexplorer.connectivity

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

/**
 * ConnectivityModule — the app's required native module (assignment §6),
 * hand-written against Android's ConnectivityManager/NetworkCallback per
 * docs/native-module-spec.md. Classic (bridge) React Native module — the
 * project has the New Architecture disabled (android/gradle.properties:
 * newArchEnabled=false), so this intentionally does not use TurboModules/
 * Codegen.
 *
 * Exposes 4 async methods (getCurrentState, checkInternetReachability,
 * startMonitoring, stopMonitoring) and emits `connectivityChanged` via
 * RCTDeviceEventEmitter, matching the JS spec in
 * src/native/connectivity/NativeConnectivityModule.ts and
 * src/native/connectivity/types.ts.
 */
class ConnectivityModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private val connectivityManager: ConnectivityManager? =
      reactContext.getSystemService(ReactApplicationContext.CONNECTIVITY_SERVICE) as? ConnectivityManager

  private var networkCallback: ConnectivityManager.NetworkCallback? = null
  private var lastEmittedState: ReadableState? = null

  override fun getName(): String = "ConnectivityModule"

  // ---- async methods -------------------------------------------------

  @ReactMethod
  fun getCurrentState(promise: Promise) {
    try {
      val state = currentState()
      promise.resolve(state.toWritableMap())
    } catch (e: Exception) {
      promise.reject("CONNECTIVITY_UNAVAILABLE", e.message, e)
    }
  }

  @ReactMethod
  fun checkInternetReachability(timeoutMs: Double?, promise: Promise) {
    Thread {
          try {
            val timeout = (timeoutMs ?: 3000.0).toInt()
            val reachable = probeInternetReachability(timeout)
            promise.resolve(reachable)
          } catch (e: Exception) {
            promise.reject("REACHABILITY_CHECK_FAILED", e.message, e)
          }
        }
        .start()
  }

  @ReactMethod
  fun startMonitoring(promise: Promise) {
    try {
      registerNetworkCallbackIfNeeded()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("MONITOR_START_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun stopMonitoring(promise: Promise) {
    try {
      unregisterNetworkCallback()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("MONITOR_STOP_FAILED", e.message, e)
    }
  }

  // RCTEventEmitter/RCTDeviceEventEmitter bridge ref-counting no-ops — JS
  // subscribes via NativeEventEmitter, which calls these automatically.
  @ReactMethod fun addListener(eventName: String?) {}

  @ReactMethod fun removeListeners(count: Int?) {}

  // ---- internals -------------------------------------------------------

  private fun registerNetworkCallbackIfNeeded() {
    if (networkCallback != null) return
    val manager = connectivityManager ?: throw IllegalStateException("ConnectivityManager unavailable")

    val callback =
        object : ConnectivityManager.NetworkCallback() {
          override fun onAvailable(network: Network) {
            emitIfChanged()
          }

          override fun onLost(network: Network) {
            emitIfChanged()
          }

          override fun onCapabilitiesChanged(
              network: Network,
              networkCapabilities: NetworkCapabilities,
          ) {
            emitIfChanged()
          }
        }

    val request = NetworkRequest.Builder().build()
    manager.registerNetworkCallback(request, callback)
    networkCallback = callback
  }

  private fun unregisterNetworkCallback() {
    val callback = networkCallback ?: return
    connectivityManager?.unregisterNetworkCallback(callback)
    networkCallback = null
    lastEmittedState = null
  }

  // BUG-015 fix (docs/BUGS.md): `lastEmittedState` used to be set
  // unconditionally, before the hasActiveReactInstance()/
  // hasActiveCatalystInstance() check below. QA's live testing flagged this
  // as an iOS-only bug, but reading this method shows the same class of
  // defect is present here too: if that check is ever false when a
  // NetworkCallback fires (no active React instance at that instant — e.g.
  // a bridge reload racing a real connectivity edge), the state was still
  // recorded as "already emitted" even though nothing was actually sent to
  // JS, so the equality check above (`state == lastEmittedState`) could
  // suppress the next genuine transition. Fixed the same way as iOS: only
  // update `lastEmittedState` after the emit actually happens.
  private fun emitIfChanged() {
    val state = currentState()
    if (state == lastEmittedState) return

    val payload = state.toWritableMap()
    payload.putDouble("timestamp", System.currentTimeMillis().toDouble())

    if (reactApplicationContext.hasActiveReactInstance() || reactApplicationContext.hasActiveCatalystInstance()) {
      reactApplicationContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("connectivityChanged", payload)
      lastEmittedState = state
    }
  }

  private fun currentState(): ReadableState {
    val manager = connectivityManager ?: return ReadableState(isConnected = false, type = "unknown", isInternetReachable = false)
    val network = manager.activeNetwork ?: return ReadableState(isConnected = false, type = "none", isInternetReachable = false)
    val capabilities = manager.getNetworkCapabilities(network)
        ?: return ReadableState(isConnected = false, type = "none", isInternetReachable = false)

    val isConnected = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) ||
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    val type =
        when {
          capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
          capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
          capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
          else -> "unknown"
        }
    val isInternetReachable = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)

    return ReadableState(isConnected = isConnected, type = type, isInternetReachable = isInternetReachable)
  }

  /** Active TCP probe distinct from "radio is up" — catches e.g. a captive portal. */
  private fun probeInternetReachability(timeoutMs: Int): Boolean {
    return try {
      Socket().use { socket ->
        socket.connect(InetSocketAddress("8.8.8.8", 53), timeoutMs)
        true
      }
    } catch (e: IOException) {
      false
    }
  }

  private data class ReadableState(
      val isConnected: Boolean,
      val type: String,
      val isInternetReachable: Boolean,
  ) {
    fun toWritableMap(): WritableMap {
      val map = Arguments.createMap()
      map.putBoolean("isConnected", isConnected)
      map.putString("type", type)
      map.putBoolean("isInternetReachable", isInternetReachable)
      return map
    }
  }
}
