# COURT CASH — Get the multiplayer prototype online

This deployment takes a GitHub repository and runs the real Node.js server on Render. The result is **one public HTTPS website** you and your friend can open on separate computers. You need your own free GitHub and Render accounts. This ZIP by itself is not a website URL.

## Step 1: Unzip this file

Download and extract the ZIP. Open the resulting `court-cash-deploy` folder. Its **contents** should include `render.yaml`, `package.json`, `server.js`, `public`, `data`, and `test`.

## Step 2: Put those contents in a GitHub repository

1. Sign in at https://github.com/ and open https://github.com/new.
2. Repository name: `court-cash-multiplayer` (or another name you prefer). It may be **private** if you connect GitHub to Render; a **public** repo is simpler for testing. This code contains no keys or secrets.
3. Click **Create repository**. Do not initialize with a README, `.gitignore`, or license since those are included in the package.
4. In the new empty repository, use **uploading an existing file** (or **Add file → Upload files**).
5. Drag the **CONTENTS** of the extracted `court-cash-deploy` folder into the GitHub file-upload area: `server.js`, `render.yaml`, `package.json`, `README.md`, `DEPLOY_ONLINE.md`, `public`, `data`, `test`, and `.node-version`. Hidden files may need to be shown or added manually. **Don't upload the ZIP as a single file, and don't nest everything inside `court-cash-deploy/` in the repository.**
6. Commit the files to the `main` branch.
7. Verify that GitHub shows `render.yaml`, `server.js`, and `package.json` **directly on the repository's main page**, and `public/` and `data/` as folders.

The GitHub web upload supports dragging files and directories; you don't need to learn command-line Git for this first deployment.

## Step 3: Deploy the server to Render

1. Sign in at https://dashboard.render.com/ (create a free account if needed).
2. Choose **New → Blueprint**. Connect GitHub when prompted.
3. Choose your `court-cash-multiplayer` repository and its `main` branch.
4. Let Render read the `render.yaml` file. It should propose **one Node web service, Free**.
5. Review the service and select **Deploy Blueprint**. Don't switch to a paid plan unless you want to.
6. Open the resulting **Web Service** in Render. When its status is **Live**, copy the provided `https://...onrender.com` URL.

If you prefer **New → Web Service** instead of Blueprint: choose your GitHub repository, select **Node** as runtime, set **Build Command** to `npm install --omit=dev`, **Start Command** to `npm start`, **Instance Type** to **Free**, and leave Root Directory blank. Optional health check path: `/health`.

## Step 4: Verify you can both connect

1. Visit the Render URL in Chrome on your computer. The Court Cash homepage should appear. If you see a loading page after inactivity, let the service wake up.
2. Visit `<your Render URL>/health` in another tab. It should return a JSON object containing `"ok":true`.
3. In the main site choose **Create Room**. Enter a team name and choose game type.
4. Share only the **website URL** and **room code** with your friend (not the private browser session token).
5. Your friend opens the same URL on a separate computer, chooses **Join Room**, and types your room code. Both browsers should show the same coin flip and auction.
6. Test bidding, draft placement, scheme selection, and starting a simulation.

## Important limitations

- **Free Render servers sleep after 15 minutes without inbound requests.** The first page open after sleep can take about a minute. The current game state is **only in server memory**. If Render restarts, redeploys, or sleeps, you may need to create a new room. Keep the site active while playing; persistent match saves are a future improvement.
- The included 32 players are placeholders, with initials rather than custom portraits. They will be replaced later.
- Two-person multiplayer is implemented, but it is a **prototype**, not fully battle-tested in a public hosting environment. Report any errors or broken states so they can be fixed.
- Do not use GitHub Pages or a static-site hosting plan for this project; the Node process is necessary for multiplayer.
- Do not post Render API keys, GitHub access tokens, or passwords in chat.

## When you have the website URL

Share the public `https://...onrender.com` address with ChatGPT, along with a screenshot or error text if anything doesn't work. The service can then be checked, and the next iteration can focus on your custom player roster and animations.
