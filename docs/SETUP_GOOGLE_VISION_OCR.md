# Set up Google Cloud Vision for receipt OCR

Follow these steps so the "Scan receipt" feature uses real OCR instead of the stub.

---

## 1. Create or use a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with your Google account.
3. In the top bar, click the project dropdown and either:
   - **Create project:** Click "New Project", name it (e.g. "Divvy"), click Create.
   - **Use existing:** Select an existing project.

---

## 2. Enable the Vision API

1. In the left menu go to **APIs & Services** → **Library** (or open [Enable APIs](https://console.cloud.google.com/apis/library)).
2. Search for **"Cloud Vision API"**.
3. Click it, then click **Enable**.

---

## 3. Create a service account (for the app to call Vision)

1. Go to **APIs & Services** → **Credentials** (or [Credentials](https://console.cloud.google.com/apis/credentials)).
2. Click **+ Create Credentials** → **Service account**.
3. **Service account name:** e.g. `divvy-ocr`.
4. Click **Create and Continue**. You can skip optional steps (roles) and click **Done**.
5. In the table, click the new service account (e.g. `divvy-ocr@your-project.iam.gserviceaccount.com`).
6. Open the **Keys** tab → **Add key** → **Create new key** → choose **JSON** → **Create**.  
   A JSON file will download; keep it private (do not commit to git).

---

## 4. Give the service account access to Vision

The service account (e.g. `divvy-ocr@your-project.iam.gserviceaccount.com`) **won’t show in the IAM list** until you grant it a role. You only see your personal email because that’s the one that has roles so far. Use either method below.

**Note:** Google’s Cloud Vision API (the one used for receipt OCR) does not always show a dedicated “Cloud Vision API User” or “Cloud Vision AI User” role in the console. The role that reliably works is **Editor** on the project. It’s broader than “just Vision,” but it’s the straightforward way to get the API working.

### Method A: Add the service account in IAM

1. Go to **IAM & Admin** → **IAM** ([IAM](https://console.cloud.google.com/iam-admin/iam)).
2. Click **+ Grant Access** (top of the page).
3. In **New principals**, paste the **service account email**. You find it in either place:
   - **Credentials** page: under "Service accounts" it looks like `divvy-ocr@your-project-id.iam.gserviceaccount.com`, or
   - The JSON key file you downloaded: open it and copy the value of `"client_email"`.
4. In **Role**, click the dropdown → search for **Editor**. Select **Editor** (the one that says “Edit access to all resources” or similar). That role lets the service account call the Vision API (and other Google Cloud APIs).
5. Click **Save**. The service account will now appear in the IAM table.

### Method B: Use the Service Accounts page

1. Go to **IAM & Admin** → **Service Accounts** ([Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)).
2. In the table, find your service account (e.g. `divvy-ocr`) and click its **email** (the long address).
3. Open the **Permissions** tab.
4. Click **+ Grant Access**.
5. In **Add principals**, add this service account if needed. In **Role**, search **Editor** and choose **Editor**, then **Save**.

After either method, the service account can call the Vision API. If you skip this step, you may get a permission-denied error when scanning a receipt.

---

## 5. Configure Divvy to use the key

### Option A: Running locally (e.g. `npm run dev`)

**5a. Use a key file path**

1. Put the downloaded JSON key somewhere safe (e.g. `~/.config/divvy/google-vision-key.json` or a folder outside the repo).
2. In the Divvy project root, create or edit `.env.local` and add:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/your-service-account-key.json
   ```
   Replace with the real path (e.g. `/Users/you/.config/divvy/google-vision-key.json`).

**5b. Or use the JSON as a string**

1. Open the downloaded JSON key in a text editor.
2. Copy the **entire** contents (one line or minified is fine).
3. In `.env.local` add (paste the JSON on the right, in one line, with quotes escaped if needed):
   ```bash
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...", ...}
   ```
   If your shell or env loader requires it, you may need to wrap in single quotes so the double quotes inside don’t break:  
   `GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ...}'`

### Option B: Deploying (e.g. Vercel)

1. In your hosting dashboard (e.g. Vercel → Project → Settings → Environment Variables), add a variable:
   - **Name:** `GOOGLE_SERVICE_ACCOUNT_JSON`
   - **Value:** Paste the **entire** contents of the service account JSON file as a single line (no newlines). You can minify the JSON first.
2. Save and redeploy so the API route sees the new variable.

---

## 6. Test it

1. Restart the dev server if it’s running (`npm run dev`).
2. In Divvy, open a session and click **Scan receipt**.
3. Take a photo or upload an image of a receipt.
4. You should see a “Reading receipt…” state, then a list of parsed line items to review and add.

If you get **403** or “permission denied”, go back to step 4 and ensure the service account has the **Editor** role (or another role that allows calling the Vision API). If you get **401** or “invalid credentials”, check that the JSON in `GOOGLE_SERVICE_ACCOUNT_JSON` or the file at `GOOGLE_APPLICATION_CREDENTIALS` is correct and complete.
