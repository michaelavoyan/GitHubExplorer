# User Guide: Public GitHub Explorer

A simple guide to using the app. No account or login is needed. It works with any public GitHub organization.

## What the app does

Search for a GitHub organization, browse its public repositories, filter them by name, view full details on any repository, and mark repositories as favorites. Favorites are saved on your device and survive an app restart.

## 1. Search for an organization

Open the app. You'll see one text field and a Search button.

1. Type the exact name of a GitHub organization (for example: `facebook`, `microsoft`, `vercel`).
2. Tap **Search**, or use your keyboard's search/enter key.

If the name doesn't match a real GitHub organization, you'll see:

> No organization named '\<what you typed\>'

with a **Retry** button. Check the spelling and try again. Organization names are exact: `facebook` works, but a name that doesn't exist on GitHub won't.

## 2. Browse repositories

Once an organization is found, you'll see its repositories listed, most recently updated first. Each row shows:

- Name and description
- Main programming language (when GitHub reports one)
- Star count, fork count, open issue count
- Last updated date

**To load more repositories**: scroll down. More load automatically as you approach the bottom of the list.

**To refresh the list**: pull down from the top and release.

**If a repository has no description**, you'll see "No description provided" in its place.

**If the organization has no public repositories**, you'll see a message saying so instead of an empty screen.

## 3. Filter repositories by name

Below the organization name is a **"Filter repositories by name"** box. Type into it to narrow the list to matching repositories within that organization. The list updates automatically as you type; there's no separate search button for this.

If your filter doesn't match anything, you'll see:

> No repositories match "\<your filter text\>"

Clear or edit the text to try again.

**Note**: this box is disabled and grayed out if the organization itself wasn't found (see §1), since there's nothing to filter in that case.

## 4. View repository details

Tap any repository row to open its details screen. You'll see:

- Full name and description
- Stars, forks, watchers, open issues
- Default branch
- License (or "None" if the repository doesn't have one)
- Created and last-updated dates
- The repository's URL

Tap the URL to open the repository in your device's browser.

## 5. Favorites

Tap the star (☆ / ★) next to any repository, either in the list or on its details screen, to favorite or unfavorite it.

- A filled gold star (★) means it's favorited.
- An empty star (☆) means it isn't.

Favorites are saved on your device and are still there the next time you open the app, even after a restart. They are **not** tied to your GitHub account and don't sync anywhere; they're local to this device only.

**If a favorite fails to save** (rare, e.g. device storage issue), you'll see a brief "Couldn't save favorite" message at the bottom of the screen. It disappears on its own after a few seconds. Nothing else on the screen is affected, and you can try again.

## 6. Working offline

If you lose your internet connection, a banner appears at the top of the app:

> You're offline, showing saved results

What this means in practice:

- **An organization or repository you've already viewed** keeps showing what it last loaded. Pull-to-refresh and infinite scroll are paused (no spinner, no wasted attempts) until you're back online.
- **An organization or repository you haven't viewed yet** can't show anything, since it was never downloaded. You'll see:

  > No saved data, reconnect to search

  or, on a details screen:

  > No saved data, reconnect to view

Once your connection returns, the banner disappears and the screen you're on refreshes automatically in the background. You don't need to do anything.

## 7. Rate limits

GitHub limits how many requests an app can make per hour without a login. If you hit that limit, you'll see:

> GitHub API rate limit reached. Try again at \<time\>.

Retry, pull-to-refresh, and infinite scroll are disabled until that time passes. The app automatically becomes usable again once the limit resets; you don't need to force-quit or reinstall. This is a GitHub-side limit, not a bug, and it resets on its own within the hour.

## Troubleshooting

Behind the scenes, the app sorts every problem into one of a few internal categories, and that category, not the raw error from GitHub, is what decides which message you see. The **Error type** column below names that category, so if you're reporting an issue, this is the useful detail to pass along.

| What you see | Error type | What it means |
|---|---|---|
| "No organization named '...'" | `NotFoundError` (404) | That exact name isn't a real GitHub organization. Check spelling. |
| "No repositories match '...'" | none (empty result, not an error) | Your filter text doesn't match any repository in this organization. |
| "\<org\> has no public repositories" | none (empty result, not an error) | The organization exists but has nothing public to show. |
| "You're offline, showing saved results" (banner) | none (device connectivity signal, not an HTTP response) | No internet connection, detected independently of any single request. Previously-viewed data still shows if available. |
| "No saved data, reconnect to search/view" | `NetworkError` (no response) | You're offline and this organization/repository was never loaded this session. |
| "GitHub API rate limit reached..." | `RateLimitError` (403 or 429) | Too many requests were made recently. Wait for the time shown; it resolves itself. |
| "Something went wrong" | `ApiError` (any other 4xx/5xx) | An unexpected error from GitHub's API (anything that isn't the cases above). Tap Retry; if it persists, check your connection. |
| "Couldn't save favorite" (brief message) | `StorageError` (not HTTP; local device storage) | A favorite didn't save. Try tapping the star again. |

The four error types (`NotFoundError` 404, `RateLimitError` 403/429, `ApiError` any other non-2xx, `NetworkError` no response at all) each map to exactly one message, decided in one place in the app, so the same problem always looks the same wherever it happens. `StorageError` is separate: it's about saving locally on your device (favorites), not about talking to GitHub, so it has no HTTP code at all.
