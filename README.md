# drop. — password-protected file sharing

Upload any file type (up to 5 GB each), get a shareable link.

## Deploy on Vercel
1. Push this folder to a GitHub repo and import it at vercel.com/new (or run `npx vercel` in this folder).
2. In the project: Storage → Create → Blob → connect it to this project (adds BLOB_READ_WRITE_TOKEN).
3. Settings → Environment Variables → add `UPLOAD_PASSWORD` with a password of your choice.
4. Redeploy.
