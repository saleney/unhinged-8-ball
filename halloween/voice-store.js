'use strict';
// Voice bytes are read from a user-selected file and stored only in this browser.
// No upload, network URL, telemetry, or server-side recording storage is used.
const VoiceStore = (() => {
  let database;
  function open() {
    if (!database) database = new Promise((resolve,reject) => {
      const request = indexedDB.open('unhinged-eightball-private-voice',1);
      request.onupgradeneeded = () => request.result.createObjectStore('clips',{keyPath:'answer'});
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); database = null; };
        resolve(db);
      };
      request.onerror = () => { database = null; reject(request.error); };
      request.onblocked = () => { database = null; reject(new Error('Close other app windows, then try again.')); };
    });
    return database;
  }
  async function read(method, key) {
    const db = await open();
    return new Promise((resolve,reject) => {
      const request = db.transaction('clips','readonly').objectStore('clips')[method](key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function replace(clips) {
    const db = await open();
    return new Promise((resolve,reject) => {
      const transaction = db.transaction('clips','readwrite');
      const store = transaction.objectStore('clips');
      try {
        store.clear();
        clips.forEach(clip => store.put(clip));
      } catch (error) { transaction.abort(); reject(error); }
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Voice import was interrupted.'));
    });
  }
  async function parsePack(file, allowedAnswers, progress = () => {}) {
    if (!file || file.size > 16*1024*1024) throw new Error('Choose your voice pack file (up to 16 MB).');
    let pack;
    try { pack = JSON.parse(await file.text()); }
    catch (_) { throw new Error('That is not a readable voice pack. Choose My-8-Ball-Voice.eightball.json.'); }
    if (pack.format !== 'unhinged-8-ball-voices' || pack.version !== 1 || !Array.isArray(pack.clips) || !pack.clips.length || pack.clips.length > 100) throw new Error('Choose the prepared 8 Ball voice pack.');
    const seen = new Set();
    const clips = [];
    let totalBytes = 0;
    for (const row of pack.clips) {
      if (!row || !allowedAnswers.has(row.answer) || seen.has(row.answer) || row.mimeType !== 'audio/wav' || typeof row.audioBase64 !== 'string' || row.audioBase64.length > 1400000 || !/^[0-9a-f]{64}$/.test(row.sha256)) throw new Error('The voice pack has an invalid or duplicate answer.');
      let bytes;
      try { bytes = Uint8Array.from(atob(row.audioBase64),char => char.charCodeAt(0)); }
      catch (_) { throw new Error('One recording is damaged. Choose the original voice pack again.'); }
      totalBytes += bytes.length;
      if (bytes.length < 44 || totalBytes > 12*1024*1024) throw new Error('The voice pack contains invalid audio.');
      const header = String.fromCharCode(...bytes.slice(0,12));
      if (!header.startsWith('RIFF') || header.slice(8,12) !== 'WAVE') throw new Error('A recording is not a WAV audio file.');
      const digest = await crypto.subtle.digest('SHA-256',bytes);
      const actual = Array.from(new Uint8Array(digest),b => b.toString(16).padStart(2,'0')).join('');
      if (actual !== row.sha256) throw new Error('A recording is incomplete or damaged. Choose the original voice pack again.');
      seen.add(row.answer);
      clips.push({answer:row.answer,bytes:bytes.buffer,mimeType:'audio/wav'});
      progress(clips.length,pack.clips.length);
    }
    return clips;
  }
  return Object.freeze({listAnswers:() => read('getAllKeys'),get:answer => read('get',answer),replace,parsePack});
})();
