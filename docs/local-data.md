# Local data

## Storage model

`lib/localData.ts` stores the template database under the browser local-storage key `krona:local-data:v1`. It provides the filtering, sorting, and mutation calls used by the UI. `lib/templateData.ts` seeds the fictional workspace on first use and preserves saved content afterward.

Other browser keys hold theme preferences, timer state, widget arrangement, and related settings. Local storage belongs to a browser profile and origin: `localhost:3000`, `localhost:3003`, and a hosted domain each have separate stores.

There is no sign-in requirement, remote database, or live collaboration. Switching Employee / Manager changes the interface and saves that preference locally. It does not authenticate a different user.

## Persistence limits

Tasks, projects, reminders, settings, and session history persist on the same browser and origin. Uploaded avatars are stored as data URLs and count toward browser storage limits. Private browsing, disabled storage, or clearing site data can remove or prevent persistence. There is no automatic cloud backup.

## Reset the sample workspace

Resetting discards local edits. If you want to preserve the template store first, open browser developer tools on the app's origin and copy the value of `krona:local-data:v1` from Local Storage to a private backup file. This is only the template database, not a complete backup of every timer and preference key.

To reset only the sample database, run this in that page's developer console and reload:

```js
localStorage.removeItem('krona:local-data:v1');
location.reload();
```

The next load reseeds the fictional workspace. Other preferences and timer state remain. To reset all app state, clear site data for this app's origin in your browser; that removes everything stored for that origin, including other apps if you served them from the same origin.

## Remote-service boundaries

- Help and feedback forms save local drafts; they send no email or support request.
- Invitations, checkout, billing, AI, and remote account workflows have no connected service.
- Team screens display local sample records rather than live coworkers.
- The adapter's realtime interface does not provide a remote subscription service.

These boundaries are part of the template. Hosting the frontend does not change them.
