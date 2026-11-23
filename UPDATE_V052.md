# COURT CASH v0.5.2 — court refinements + deployment verification

## Court tweaks requested
- Keep all four courts, each with a uniform **25% selection at game start** and the same court visible to both players.
- Increase drawing canvas height from **940×500 to 940×525** (5% taller).
- Bring the corner-three lines a little closer to each basket: at original 940px width, the connected left arc joins its top/bottom straight sections at **x≈133.4** instead of x≈159; right arc joins at **x≈806.6** instead of x≈781.
- Reduce maximum arc distance from each basket from **237.5px to 231.5px**.
- New continuous corner heights are **y=40** and **y=485** on the 525px court.
- Raise key/paint height from 188 to 198px to match the taller court.
- Maintain animation geometry, hit-testing, CSS aspect ratio and scaled pass-lane distances.

## Why a GitHub update might not show up on Render
- GitHub code on the default branch is **not proof** that Render deployed that commit. Check the Render service's **Deploys** tab and Git commit.
- The Blueprint now explicitly requests **autoDeployTrigger: commit**, but this only applies if a Render **Blueprint is connected/synced to this repository**. A manually configured Render web service has its own deploy settings.
- The server now serves HTML, JavaScript and CSS with **Cache-Control: no-store**, avoiding stale UI code after new deploys.
- The app's visible header says **ALPHA v0.5.2**. GET **/health** also reports **version: 0.5.2** and (on Render, when provided) **gitCommit**.
- Verification steps:
  1. Visit the Render dashboard → COURT CASH service → **Deploys**. Compare the live deployed Git commit against the latest GitHub main commit.
  2. If not current: click **Manual Deploy → Deploy latest commit**. Then check **Settings → Build & Deploy → Auto-Deploy: On Commit** for future updates.
  3. Visit **https://court-cash-multiplayer.onrender.com/health** and confirm **version: "0.5.2"**. Reload the game in a new tab and confirm **ALPHA v0.5.2** in the header.
  4. Start **a NEW game** to see a newly selected court style; a prior server session/state may represent an earlier build.

No custom-player imports, altered wheel weights, or other gameplay changes in this release.
