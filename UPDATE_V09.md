# Court Cash — V0.9: Admin Panel & Court Portrait Editor

## Entry and access

- A **small circular blue button with a white lock** appears at the **top-right of the MAIN MENU ONLY**. It is nested within the welcome screen and automatically disappears when a room/game screen is shown.
- Click it, enter the requested **four-digit admin code (8371)**, and unlock the editor. Code verification happens on the server; the PIN is not embedded in front-end JavaScript.
- Invalid attempts are throttled (five incorrect guesses lock out that connection for 15 minutes). Sessions are server-issued tokens that expire after two hours.
- **Security notice:** A four-digit code is convenience access, not strong account security. Production should set a different COURT_CASH_ADMIN_CODE as a secret environment variable and use stronger authentication if exposing administrative controls to the public.

## Player list and editing

- The panel displays the players **currently imported into the running game**, ordered **highest OVR first**, with a name search.
- Each row shows the **original picture and its matching circular, on-court portrait** next to one another.
- Select a player to see their original artwork (never modified) and a **44×44-pixel court circle**. This is the actual in-game circle size; there is no separate or duplicate "preview on court" button.
- Drag the circular photo to move it, or use **Zoom / Horizontal / Vertical** sliders. The circle updates instantly.
- Click **Save appearance** to update that player's server-side crop. Actual games use the exact same CourtHeadshots.draw() implementation as the editor. Player stats, draft pictures and names are not changed.
- **Reset** previews the base crop; **Save** restores the default.
- All connected rooms receive updated player metadata when an appearance is saved.

## Persistence and backups

- Settings are saved on the server as JSON, by default to data/court-portrait-overrides.json. Override that path with COURT_CASH_PORTRAITS_FILE on a writable **persistent disk** for durability across deploys.
- **Important for current free Render deployment:** Free web instances have ephemeral local storage. Saves work across players/devices and during the same instance lifetime, but a redeploy/restart can erase files in the container. The admin panel therefore includes **Export settings** and **Import settings** for explicit backup and restoration. Export after making adjustments.
- No database import is performed by V0.9. The editor currently lists the **temporary live test roster** until the custom player databases are imported in a future update. New imported players automatically appear because the list is generated from data/players.json.

## Implementation and compatibility

- Server: admin-v09.js provides server-side admin authentication, read-only OVR-sorted player list, crop-save/reset and JSON backup endpoints.
- UI: public/admin-v09.js and public/admin-v09.css, with main-menu lock and overlay markup in public/index.html.
- Existing public/court-headshots.js is reused **without modification**.
- No gameplay mechanics, simulations, shots, attributes, probability weights, draft rules or players are modified.
- Automated tests: test/v09-admin.test.js.
