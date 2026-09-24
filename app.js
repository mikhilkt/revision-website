const owner = 'mikhilkt';
const repo = 'revision-website';
const subjects = [
  { name: 'NLP', description: 'Natural Language Processing', color: '#9d8cff' },
  { name: 'BI', description: 'Business Intelligence', color: '#68d5c0' },
  { name: 'IS Security', description: 'Information Systems Security', color: '#f0b56f' }
];

const grid = document.querySelector('#subjects');
const status = document.querySelector('#status');
const empty = document.querySelector('#empty');
const search = document.querySelector('#search');
let filesBySubject = {};
let pdfViewer;

function displayName(path) {
  return path.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
}

function pdfUrl(file) {
  // Resolve against the deployed site so this works on GitHub Pages and
  // custom domains. The site's PDF response is rendered by the browser.
  return new URL(file.path.split('/').map(encodeURIComponent).join('/'), document.baseURI).href;
}

function createPdfViewer() {
  if (pdfViewer) return pdfViewer;

  pdfViewer = document.createElement('div');
  pdfViewer.className = 'pdf-viewer';
  pdfViewer.hidden = true;
  pdfViewer.setAttribute('role', 'dialog');
  pdfViewer.setAttribute('aria-modal', 'true');
  pdfViewer.setAttribute('aria-label', 'PDF viewer');
  pdfViewer.innerHTML = `
    <div class="pdf-viewer-backdrop" data-close-pdf></div>
    <div class="pdf-viewer-panel">
      <div class="pdf-viewer-toolbar">
        <h2 class="pdf-viewer-title"></h2>
        <button type="button" class="pdf-viewer-close" aria-label="Close PDF viewer">&times;</button>
      </div>
      <iframe class="pdf-viewer-frame" title="PDF document"></iframe>
    </div>`;
  document.body.appendChild(pdfViewer);

  const close = () => {
    pdfViewer.hidden = true;
    pdfViewer.querySelector('.pdf-viewer-frame').src = 'about:blank';
    document.body.classList.remove('pdf-viewer-open');
  };

  pdfViewer.querySelector('.pdf-viewer-close').addEventListener('click', close);
  pdfViewer.querySelector('[data-close-pdf]').addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !pdfViewer.hidden) close();
  });
  return pdfViewer;
}

function openPdf(file) {
  const viewer = createPdfViewer();
  viewer.querySelector('.pdf-viewer-title').textContent = displayName(file.name);
  viewer.querySelector('.pdf-viewer-frame').src = pdfUrl(file);
  viewer.hidden = false;
  document.body.classList.add('pdf-viewer-open');
}

function render(filter = '') {
  const query = filter.trim().toLowerCase();
  let visible = 0;

  grid.innerHTML = subjects.map(subject => {
    const files = (filesBySubject[subject.name] || []).filter(file =>
      !query ||
      subject.name.toLowerCase().includes(query) ||
      file.name.toLowerCase().includes(query)
    );
    visible += files.length;

    return `<article class="subject">
      <div class="subject-head" style="border-top:3px solid ${subject.color}">
        <h2>${subject.name}</h2>
        <p>${subject.description}</p>
      </div>
      <div class="notes">
        ${files.length ? files.map(file => `<a class="note" href="${pdfUrl(file)}" data-pdf-path="${encodeURIComponent(file.path)}">
          <span><span class="pdf-icon">▣</span>&nbsp; ${displayName(file.name)}</span>
          <span class="open">Open PDF ↗</span>
        </a>`).join('') : '<div class="no-notes">No PDFs uploaded yet</div>'}
      </div>
    </article>`;
  }).join('');

  empty.hidden = visible !== 0;

  grid.querySelectorAll('[data-pdf-path]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const path = decodeURIComponent(link.dataset.pdfPath);
      const subject = subjects.find(item => path.startsWith(`${item.name}/`));
      const file = (filesBySubject[subject?.name] || []).find(item => item.path === path);
      if (file) openPdf(file);
    });
  });
}

async function loadNotes() {
  try {
    const results = await Promise.all(subjects.map(async subject => {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(subject.name)}`);
      if (!response.ok) throw new Error('Unable to load notes');
      const files = await response.json();
      return [subject.name, files.filter(file =>
        file.type === 'file' && file.name.toLowerCase().endsWith('.pdf')
      )];
    }));

    filesBySubject = Object.fromEntries(results);
    const count = Object.values(filesBySubject).reduce((total, files) => total + files.length, 0);
    status.textContent = `${count} PDF${count === 1 ? '' : 's'} available`;
    render();
  } catch (error) {
    status.textContent = 'Notes could not be loaded right now';
    render();
  }
}

search.addEventListener('input', event => render(event.target.value));
document.querySelector('#year').textContent = new Date().getFullYear();

// Keep the viewer self-contained so PDFs are displayed in the website rather
// than navigating to a download URL.
const viewerStyles = document.createElement('style');
viewerStyles.textContent = `
  .pdf-viewer[hidden] { display: none; }
  .pdf-viewer { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 1rem; }
  .pdf-viewer-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, .82); }
  .pdf-viewer-panel { position: relative; z-index: 1; width: min(1100px, 100%); height: min(90vh, 900px); display: flex; flex-direction: column; background: #131720; border: 1px solid #282e3b; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, .5); }
  .pdf-viewer-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .75rem 1rem; border-bottom: 1px solid #282e3b; }
  .pdf-viewer-title { margin: 0; font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pdf-viewer-close { border: 0; background: transparent; color: inherit; font-size: 1.8rem; line-height: 1; cursor: pointer; padding: 0 .25rem; }
  .pdf-viewer-frame { width: 100%; flex: 1; border: 0; background: #fff; }
  .pdf-viewer-open { overflow: hidden; }
  @media (max-width: 600px) { .pdf-viewer { padding: 0; } .pdf-viewer-panel { width: 100%; height: 100%; border-radius: 0; } }
`;
document.head.appendChild(viewerStyles);

loadNotes();
