"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

const PW_KEY = "drop-pw";

function fmtSize(n) {
  if (n == null) return "";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n < 10 && i ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
}

function fmtDate(d) {
  const date = new Date(d);
  const diff = (Date.now() - date) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function displayName(pathname) {
  // strip the random suffix Vercel Blob adds: name-AbC123xyz.ext
  return pathname.replace(/-[A-Za-z0-9]{20,40}(?=\.[^.]+$|$)/, "");
}

function extOf(name) {
  const m = name.match(/\.([^.]+)$/);
  return m ? m[1].slice(0, 4).toUpperCase() : "FILE";
}

export default function Home() {
  const [password, setPassword] = useState(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [checking, setChecking] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(null);
  const [filter, setFilter] = useState("");
  const inputRef = useRef(null);
  const dragDepth = useRef(0);

  const loadFiles = useCallback(async (pw) => {
    setLoading(true);
    try {
      const res = await fetch("/api/files", { headers: { "x-password": pw } });
      if (res.status === 401) return false;
      const data = await res.json();
      setFiles(data.files || []);
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let saved = null;
    try { saved = localStorage.getItem(PW_KEY); } catch {}
    if (saved) {
      loadFiles(saved).then((ok) => {
        if (ok) setPassword(saved);
        else { try { localStorage.removeItem(PW_KEY); } catch {} }
      });
    }
  }, [loadFiles]);

  async function signIn(e) {
    e.preventDefault();
    setChecking(true);
    setPwError("");
    const ok = await loadFiles(pwInput);
    setChecking(false);
    if (!ok) { setPwError("That password isn't right."); return; }
    try { localStorage.setItem(PW_KEY, pwInput); } catch {}
    setPassword(pwInput);
  }

  function signOut() {
    try { localStorage.removeItem(PW_KEY); } catch {}
    setPassword(null);
    setFiles([]);
    setPwInput("");
  }

  const startUploads = useCallback(
    (fileList) => {
      const list = Array.from(fileList || []);
      if (!list.length || !password) return;
      list.forEach((file) => {
        const id = `${Date.now()}-${Math.random()}`;
        setUploads((u) => [{ id, name: file.name, size: file.size, pct: 0, status: "uploading" }, ...u]);
        const safeName = file.name.replace(/[^\w.\- ()]+/g, "_") || "file";
        upload(safeName, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload: password,
          multipart: file.size > 20 * 1024 * 1024,
          onUploadProgress: ({ percentage }) =>
            setUploads((u) => u.map((x) => (x.id === id ? { ...x, pct: percentage } : x))),
        })
          .then((blob) => {
            setUploads((u) => u.filter((x) => x.id !== id));
            setFiles((f) => [
              { url: blob.url, downloadUrl: blob.downloadUrl, pathname: blob.pathname, size: file.size, uploadedAt: new Date().toISOString() },
              ...f,
            ]);
          })
          .catch((err) => {
            setUploads((u) => u.map((x) => (x.id === id ? { ...x, status: "error", error: err.message } : x)));
          });
      });
    },
    [password]
  );

  useEffect(() => {
    if (!password) return;
    const onPaste = (e) => {
      if (e.clipboardData?.files?.length) startUploads(e.clipboardData.files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [password, startUploads]);

  async function copy(url) {
    try { await navigator.clipboard.writeText(url); } catch {
      const t = document.createElement("textarea"); t.value = url; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    setCopied(url);
    setTimeout(() => setCopied((c) => (c === url ? null : c)), 1600);
  }

  async function remove(file) {
    if (!window.confirm(`Delete "${displayName(file.pathname)}"? Its link will stop working.`)) return;
    setFiles((f) => f.filter((x) => x.url !== file.url));
    const res = await fetch("/api/files", {
      method: "DELETE",
      headers: { "x-password": password, "content-type": "application/json" },
      body: JSON.stringify({ url: file.url }),
    });
    if (!res.ok) loadFiles(password);
  }

  if (!password) {
    return (
      <main className="gate">
        <form onSubmit={signIn} className="gate-card">
          <div className="logo">drop<span>.</span></div>
          <p className="muted">Enter the password to upload.</p>
          <input
            type="password"
            autoFocus
            placeholder="Password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
          />
          {pwError && <p className="err">{pwError}</p>}
          <button className="primary" disabled={!pwInput || checking}>
            {checking ? "Checking…" : "Open"}
          </button>
        </form>
      </main>
    );
  }

  const shown = files.filter((f) => !filter || f.pathname.toLowerCase().includes(filter.toLowerCase()));
  const total = files.reduce((s, f) => s + (f.size || 0), 0);

  return (
    <main
      className="app"
      onDragEnter={(e) => { e.preventDefault(); dragDepth.current++; setDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { dragDepth.current--; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
      onDrop={(e) => { e.preventDefault(); dragDepth.current = 0; setDragging(false); startUploads(e.dataTransfer.files); }}
    >
      <header>
        <div className="logo">drop<span>.</span></div>
        <button className="ghost" onClick={signOut}>Lock</button>
      </header>

      <button className={`zone ${dragging ? "over" : ""}`} onClick={() => inputRef.current?.click()}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <strong>Drop files here, or click to choose</strong>
        <span className="muted">Any file type · up to 5 GB each · you can also paste</span>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => { startUploads(e.target.files); e.target.value = ""; }} />
      </button>

      {uploads.length > 0 && (
        <ul className="list">
          {uploads.map((u) => (
            <li key={u.id} className={`row ${u.status}`}>
              <div className="badge">{extOf(u.name)}</div>
              <div className="meta">
                <div className="name">{u.name}</div>
                {u.status === "error" ? (
                  <div className="err small">Failed: {u.error}</div>
                ) : (
                  <div className="bar"><div style={{ width: `${u.pct}%` }} /></div>
                )}
              </div>
              <div className="actions">
                {u.status === "error" ? (
                  <button className="ghost" onClick={() => setUploads((x) => x.filter((y) => y.id !== u.id))}>Dismiss</button>
                ) : (
                  <span className="muted small">{Math.round(u.pct)}% of {fmtSize(u.size)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <section>
        <div className="section-head">
          <h2>Files <span className="muted">{files.length} · {fmtSize(total)}</span></h2>
          {files.length > 5 && (
            <input className="search" placeholder="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />
          )}
        </div>
        {loading && !files.length ? (
          <p className="muted empty">Loading…</p>
        ) : !files.length ? (
          <p className="muted empty">Nothing here yet. Your uploads will show up here with a link to share.</p>
        ) : (
          <ul className="list">
            {shown.map((f) => {
              const name = displayName(f.pathname);
              return (
                <li key={f.url} className="row">
                  <div className="badge">{extOf(name)}</div>
                  <div className="meta">
                    <a className="name" href={f.url} target="_blank" rel="noreferrer">{name}</a>
                    <div className="muted small">{fmtSize(f.size)} · {fmtDate(f.uploadedAt)}</div>
                  </div>
                  <div className="actions">
                    <button className={`primary sm ${copied === f.url ? "done" : ""}`} onClick={() => copy(f.url)}>
                      {copied === f.url ? "Copied" : "Copy link"}
                    </button>
                    <a className="ghost icon" href={f.downloadUrl || f.url} title="Download" aria-label="Download">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M6 10l6 6 6-6M4 20h16" /></svg>
                    </a>
                    <button className="ghost icon danger" onClick={() => remove(f)} title="Delete" aria-label="Delete">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {dragging && <div className="veil">Drop to upload</div>}
    </main>
  );
}
