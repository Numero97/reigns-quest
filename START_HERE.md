# Reign's Quest: how to put it on your iPad (one time)

## A. Make the GitHub home for the game (once)
1. Go to https://github.com and sign in. Click the **+** (top right) > **New repository**.
2. Name it `reigns-quest`. Choose **Public** (free Pages needs this). Do NOT tick any "add a file" boxes. Click **Create repository**.
3. In the repository, click **Settings** > **Pages** (left side). Under **Build and deployment > Source**, choose **GitHub Actions**.

## B. Send the game files up (once, then again after each change)
Ask Claude: "push to GitHub" and give it the repository address (looks like https://github.com/YOURNAME/reigns-quest). Claude will tell you exactly what to click if it needs your sign-in.

## C. Open it on the iPad
1. Wait about 2 minutes after the push. In the repository, click the **Actions** tab. A green check means it is ready.
2. On the iPad, open Safari and go to `https://YOURNAME.github.io/reigns-quest/`
3. Tap the **Share** button > **Add to Home Screen**. Open it once from the new icon while online. After that it works with no internet.

## Grown-ups menu
Press and hold the top-left corner of the screen for 3 seconds. You can jump to a scene, reset progress, mute, and turn on **Debug captions** (shows the words of any line you have not recorded yet).

## Where things you edit live
- `content/config.json`: cat name, letters she knows, number limits, scene order
- `content/scenes/*.json`: one file per scene
- `content/audio_script*.csv`: the lines you will record
- `public/assets/audio/`: your recordings (`.m4a`), named by the line's id
- `public/assets/backgrounds/`, `sprites/`, `lineart/`: art (`.png`), named by id
