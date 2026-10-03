# Daymark

A private, Firebase-backed life planner with a fast habit grid, tasks, goals, weekly meals and training, daily reviews, real analytics, offline caching, a PWA, and a Capacitor Android project.

## What is included

- Email/password sign-up, sign-in, password reset, verification email, persistent sign-in and account deletion.
- Per-user Firestore collections with ownership and field validation rules.
- Day, week, month and custom-range habit tracking. Click cells to cycle; right click for a missed day. On a phone, Day view uses large ✓ and × buttons. Numeric habits also accept an actual value in Today's view.
- Tasks with dates, time, priority, duration, notes, completion, editing and move-to-today for unfinished past tasks.
- Goals with target, progress, deadline, status, related habit reference and milestone text. Goal progress is manually updated; it is not automatically inferred from habit records.
- Repeating weekly meal and workout plans with per-date completion records. Workout exercise details are free-form lines for sets, reps, weight and rest.
- Daily review, monthly analytics and streaks calculated from Firestore records. Skipped/N/A days are excluded from completion denominator; pending scheduled days count. A habit edit never overwrites its dated records. Archived habits retain recorded history.
- Firestore IndexedDB persistence, live subscriptions and pending/cached status. On conflicting edits to the same document across devices, Firestore uses last write wins. The app shell is precached for offline launches. First sign-in needs a connection.
- JSON backup export/import, light/dark/system themes, Monday/Sunday week start, responsive desktop and mobile layout.

**Scope notes:** No push/background reminders, external calendar integration, automatic goal aggregation, or automatic conflict merge UI. The selected time format controls the header clock; browser locale formats calendar labels. Long histories are currently subscribed in full; for very large accounts, move analytics to bounded queries/aggregates. Account deletion happens client-side in batches and needs connectivity; do not close the page while it runs. A reauthentication step comes before deletion. The Android project is generated, but an APK requires Android Studio and your own signing/device actions.

## Project structure

```text
life-os/
├─ android/                    Capacitor Android project (generated and included)
├─ public/                     PWA icons
├─ src/
│  ├─ components/Modal.tsx
│  ├─ lib/
│  │  ├─ analytics.ts         Completion and streak calculations
│  │  ├─ date.ts              Local calendar-date utilities
│  │  ├─ firebase.ts          Firebase SDK and IndexedDB cache
│  │  ├─ store.ts             Firestore reads, writes, backup, deletion
│  │  └─ types.ts             Firestore document types
│  ├─ App.tsx                  Screens, forms and interactions
│  ├─ main.tsx
│  ├─ styles.css
│  └─ vite-env.d.ts
├─ scripts/clean-generated.mjs  Prevent stale PWA bundles
├─ tests/date-analytics.test.ts
├─ .env.example
├─ capacitor.config.ts
├─ firebase.json
├─ firestore.indexes.json
├─ firestore.rules
├─ index.html
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ vercel.json
└─ vite.config.ts
```

## 1. Install software on your Windows laptop

1. Install [Node.js](https://nodejs.org/) version **22.12 or later** (or current LTS). Use the Windows installer, keeping “Add to PATH” selected. Close and reopen your terminal after installation.
2. Install [VS Code](https://code.visualstudio.com/). Optional: install its ESLint/Prettier extensions, though neither is needed to run this project.
3. Install [Git for Windows](https://git-scm.com/download/win) if you want to publish through a Git repository. Choose the default installer options.
4. For APK generation later, install [Android Studio](https://developer.android.com/studio). In its setup wizard install Android SDK, Platform Tools and an Android SDK Platform. Android Studio supplies the appropriate JDK; a separate JDK is not required.
5. Check Node/npm in PowerShell: `node --version` and `npm --version`. If PowerShell says commands are not found, restart VS Code/PowerShell and confirm Node was installed.

## 2. Unzip, open and install

1. Download and extract `daymark-life-os.zip` to a folder such as `C:\Users\YOUR_NAME\Documents\daymark-life-os`.
2. Open VS Code → **File → Open Folder…** → choose the extracted `life-os` folder (the folder containing `package.json`).
3. Open **Terminal → New Terminal**. It should show the project folder. If it does not, run `cd "C:\Users\YOUR_NAME\Documents\daymark-life-os\life-os"` with your actual path.
4. Run:

```powershell
npm ci
Copy-Item .env.example .env.local
```

5. Leave `.env.local` open in VS Code. You will fill it in after creating Firebase. Never upload `.env.local` to GitHub or share its contents. The Firebase web config identifies your project; the **Firestore security rules**, not a hidden API key, protect account data.

## 3. Create your Firebase project

1. Sign in at [Firebase Console](https://console.firebase.google.com/) with your Google account.
2. Click **Add project**, choose a name, and follow the wizard. Google Analytics is not needed for Daymark; you can turn it off.
3. On **Project overview**, click the **web** (`</>`) icon to add a web app. Give it a nickname such as `Daymark Web`. Firebase Hosting is not needed because Vercel hosts the web app. Click **Register app**.
4. Firebase shows a `firebaseConfig` object. Copy its values into `.env.local`:

```dotenv
VITE_FIREBASE_API_KEY=your_apiKey
VITE_FIREBASE_AUTH_DOMAIN=your_authDomain
VITE_FIREBASE_PROJECT_ID=your_projectId
VITE_FIREBASE_APP_ID=your_appId
VITE_FIREBASE_STORAGE_BUCKET=your_storageBucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messagingSenderId
```

Use the actual values from **Project settings → General → Your apps → SDK setup and configuration → Config**. No quotation marks are required. Keep the `.firebaseapp.com` authDomain shown by Firebase; do not replace it with the Vercel domain. Save the file.

## 4. Turn on Authentication and Firestore

1. In Firebase Console, open **Build/Security → Authentication** (Console navigation may vary) → **Get started** → **Sign-in method**.
2. Enable **Email/Password**, then **Save**. You do not need the separate email-link option.
3. In **Authentication → Settings → Authorized domains**, add `localhost` if it is absent. Newer Firebase projects may not include it automatically. After deployment, add your exact Vercel hostname, without `https://` or a trailing slash. For the bundled Capacitor Android WebView (`https://localhost`), `localhost` is also the relevant origin.
4. Open **Build → Firestore Database** → **Create database**. Choose the **Standard** database with ID `(default)`, select a region near you (for India, `asia-south1` if offered), and choose **production mode**. The region cannot normally be changed later. No Firestore Storage bucket is required for app data.
5. Before creating account data, publish the included security rules. In **Firestore Database → Rules**, replace the editor contents with the entire `firestore.rules` file and click **Publish**. These rules allow only the signed-in account to access its own `users/{uid}` path and validate writes. Do not use “test mode” rules for this app.
6. **Indexes:** `firestore.indexes.json` is intentionally empty. Current screens read each user's own collections without compound queries, so no composite index is needed. Firebase creates ordinary single-field indexes automatically.
7. Optional CLI method instead of pasting rules: run `npm install -g firebase-tools`, then `firebase login`, then `firebase deploy --only firestore --project YOUR_FIREBASE_PROJECT_ID` from the project folder. This publishes `firestore.rules` and the empty index configuration. Use the project ID from the Firebase settings, not the display name.

## 5. Run locally and create the first account

1. In VS Code terminal run `npm run dev`.
2. Open the printed URL, usually `http://localhost:5173/`, in Chrome or Edge. If the page says Firebase values are missing, check `.env.local`, stop the server with **Ctrl+C**, and restart `npm run dev`.
3. Click **Create an account**, enter a name, email and password (at least six characters), then submit. Check your inbox/spam for Firebase's verification email and click its link. If it does not arrive, use **Settings → Resend verification email**.
4. Open **Firebase Console → Authentication → Users**: you should see your new email and UID.
5. Create a habit in Daymark. Open **Firestore Database → Data → users → [your UID] → habits** to see its document. Completing a day creates a document under `records`. Tasks, goals, meals, workouts, reviews and planRecords each have their own subcollection.
6. If you get `Missing or insufficient permissions`, make sure rules are published to the same Firebase project named in `.env.local`, that you are signed in, and that the Firestore database ID is `(default)`.

## 6. Test the main features

- **Habits:** Add a daily habit, mark it ✓ and × in Today, then open Tracker and switch Day/Week/Month. Tap a cell to cycle through pending, completed, missed, skipped and N/A. Try a custom date range, edit the title, archive/restore and duplicate. Records remain in `records` after an edit.
- **Numeric habit:** Make a Count/Duration/Numeric habit with a target. In Today, click its `0/target` control, enter an actual value, and check that reaching the target marks it complete.
- **Planner:** Add a task with a date/time/priority, mark it done, edit it to a new date, then create an overdue task and use **Move to today**. Add a goal and use +/− for progress. Enter a daily review.
- **Meals/Training:** Add plans for today’s weekday; use ✓ and ×. Switch the calendar date to the same weekday next week and verify that the plan repeats while its completion is independent. Duplicate/edit a plan.
- **Insights:** Complete and miss several dated habits, then open Insights. The trend, habit rates, streaks and monthly totals must change. There are no seeded statistics.
- **Backup:** In Settings, export JSON and store it privately. Import the same file to verify the format (matching IDs overwrite; it does not make duplicates).
- **Cross-device sync:** Sign in with the same account on a second browser/device, change a habit on one, and wait for the other to update. Use the **Synced** indicator. Both must use the same Firebase project.
- **Offline:** While signed in online, open each screen once. In browser DevTools → Network select **Offline** (or disconnect network). Reload if the service worker has finished installing, mark a habit, and observe **Offline/Syncing**. Reconnect and wait for **Synced**, then confirm the record on another device and in Firestore. First account creation/sign-in cannot happen offline. Offline data is stored on that device; clear browser site data if using a shared computer.
- **Security:** Create a second account; its dashboard should have none of the first account's data. To test a denial directly, use Firestore Rules Playground with an unauthenticated user or a different UID against `users/FIRST_UID/habits/...`.

## 7. Build and deploy the web app to Vercel

1. From the project folder run `npm test`, then `npm run build`. The production app is in `dist/`. Run `npm run preview` and open the printed URL for a local production check. Stop it with **Ctrl+C**.
2. Create a **private** GitHub/GitLab/Bitbucket repository if desired. In the project folder, run `git init`, `git add .`, `git commit -m "Initial Daymark app"`, `git branch -M main`, then add your repository remote and `git push -u origin main` according to your host’s instructions. `.env.local` and build output are ignored.
3. Sign in to [Vercel](https://vercel.com/) → **Add New → Project** → import the repository. Select `life-os` as the root directory only if you placed it inside a larger repository; for a repo containing `package.json` at its root, leave Root Directory as `./`.
4. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`. Install command: `npm ci` (or leave automatic install if it uses the lockfile).
5. Under **Environment Variables**, enter each of the six `VITE_FIREBASE_...` names and its value from `.env.local` for Production (and Preview if you want previews to work). They are build-time values; redeploy after changing one. Click **Deploy**.
6. Open the generated `https://YOUR-PROJECT.vercel.app` URL. In Firebase Console → **Authentication → Settings → Authorized domains**, add `YOUR-PROJECT.vercel.app` (hostname only). Add any custom production domain as well. You may add preview domains individually as needed.
7. Test account sign-in and a Firestore write on the live URL. `vercel.json` serves the app shell for route refreshes. Do not deploy the separate Firebase Hosting service.

## 8. Install the PWA

After visiting your Vercel HTTPS URL in Chrome/Edge on Android or desktop, use the browser menu **Install app**/**Add to Home screen** (or the install icon in the address bar). Open Daymark from its new icon, sign in online once, and revisit screens you want available offline. PWA availability and install wording depend on browser/OS. On iPhone Safari use **Share → Add to Home Screen**. The local development URL is useful for testing; production HTTPS is the normal install target.

## 9. Build and install a real Android APK

The `android/` native Capacitor project is included. This is a bundled WebView application using the same built frontend and Firebase backend, not a shortcut to Vercel. You must use your laptop's Android SDK for the APK.

1. Complete Firebase setup and `.env.local` first. In VS Code terminal run `npm ci`, then `npm run android:sync`. This builds `dist/` with your Firebase config and copies it into `android/`. Repeat this command after every web code or environment change before rebuilding the APK.
2. Run `npm run android:open` to open the included Android project in Android Studio. Allow Gradle sync and SDK downloads to finish. If VS Code cannot find Android Studio, open Android Studio manually → **Open** → select the project's `android` folder.
3. In Android Studio, choose an emulator or connect your Android phone by USB, enable **Developer options → USB debugging** on the phone, accept its debugging prompt, and click **Run**. Sign in and test the app.
4. To make a shareable debug APK: Android Studio → **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Click the notification's **locate** link. The file is normally `android/app/build/outputs/apk/debug/app-debug.apk`. A debug APK is installable for personal testing and signed by Android Studio's debug key, but should not be used for Play Store distribution.
5. For a release APK: **Build → Generate Signed Bundle / APK → APK → Create new keystore**, set and safely store its path, passwords and alias, choose `release`, then build. Never put the keystore or passwords in this project/zip; losing the key complicates future updates. Android Studio shows the resulting path (normally under `android/app/release/`). For Play Store distribution, choose an **Android App Bundle** and follow Play signing requirements.
6. Transfer the APK to your phone by USB, Drive, or WhatsApp. Open it on the phone and allow **Install unknown apps** for that file manager/browser if Android prompts. Install and launch. Keep the file from trusted sources only.
7. `localhost` must be authorized in Firebase Authentication settings for this Capacitor WebView origin. The Android manifest already includes internet permission. Verification/reset emails open in a browser; then return to the app to sign in.
8. Test a habit update offline in the APK and reconnect. Check the same account on the web app. Web and APK should show the same Firestore records.

## 10. Troubleshooting

| Problem | Check |
| --- | --- |
| Blank page or missing Firebase values | `.env.local` has all six values; restart Vite or redeploy Vercel after a change. Inspect browser console for the exact error. |
| `auth/operation-not-allowed` | Enable Email/Password in Firebase Authentication. |
| `auth/unauthorized-domain` | Add the exact host in Authentication → Settings → Authorized domains. Include `localhost` for local/Capacitor. |
| `permission-denied` | Publish `firestore.rules`, use the `(default)` database and confirm the signed-in account and Firebase project ID match. |
| Data looks stale/offline | Check the network and status indicator; leave the app open until **Synced**, then refresh. Firestore last-write-wins on the same document. |
| New Android code not in APK | Run `npm run android:sync` again, then rebuild the APK in Android Studio. |
| Gradle/SDK error | Use Android Studio's SDK Manager to install the requested platform/build tools; sync Gradle. Use the JDK supplied by Android Studio. |
| PWA does not offer install | Use HTTPS on Vercel, make sure the page loaded, and check Chrome/Edge install options. Clear stale site data only after queued offline writes have synced. |
| Account deletion fails | Sign in again, ensure connectivity, then retry with password. Export a backup first. If a partial deletion occurred, the next run deletes remaining documents. |

## Data model and limitations

`users/{uid}` holds preferences. Child collections: `habits/{id}`, `records/{habitId_YYYY-MM-DD}`, `tasks/{id}`, `goals/{id}`, `meals/{id}`, `workouts/{id}`, `planRecords/{kind_planId_YYYY-MM-DD}`, `reviews/{YYYY-MM-DD}`. Calendar dates are local `YYYY-MM-DD` strings, constructed without UTC conversion. Plan definitions repeat by weekday; dated outcomes remain separate. The app uses no composite Firestore queries, server code, custom claims, service account key, or Firebase Storage.

The Firestore web SDK queues local mutations and synchronizes them automatically, with last-write-wins for conflicting writes to the same document. The PWA caches the shell. The real Firebase project and Android signing remain account/device actions, so this repository cannot contain your Firebase credentials or a prebuilt working APK.
