// Small UI helpers: escaping, toasts, modals, tiny markdown renderer.
const UI = (() => {
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg, type = 'info') {
    const colors = { info: 'bg-slate-800', success: 'bg-emerald-600', error: 'bg-red-600' };
    const el = document.createElement('div');
    el.className = `fixed bottom-4 right-4 z-50 text-white px-4 py-2 rounded-lg shadow-lg text-sm ${colors[type] || colors.info}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // Generic modal. `html` is the inner body; returns the modal element.
  function modal(title, html, { wide = false } = {}) {
    const root = document.getElementById('modalRoot');
    const width = wide ? 'max-w-2xl' : 'max-w-md';
    root.innerHTML = `
      <div class="fixed inset-0 z-40 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" data-overlay>
        <div class="bg-white rounded-2xl shadow-2xl w-full ${width} my-8">
          <div class="flex items-center justify-between px-5 py-3 border-b border-slate-200">
            <h3 class="font-semibold">${esc(title)}</h3>
            <button data-close class="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
          </div>
          <div class="p-5">${html}</div>
        </div>
      </div>`;
    const overlay = root.querySelector('[data-overlay]');
    const close = () => (root.innerHTML = '');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    root.querySelector('[data-close]').addEventListener('click', close);
    return { root, close };
  }

  async function confirm(message) {
    return new Promise((resolve) => {
      const m = modal('Confirm', `
        <p class="text-sm text-slate-600 mb-4">${esc(message)}</p>
        <div class="flex justify-end gap-2">
          <button data-no class="px-3 py-1.5 rounded-lg border border-slate-300 text-sm">Cancel</button>
          <button data-yes class="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm">Confirm</button>
        </div>`);
      m.root.querySelector('[data-no]').onclick = () => { m.close(); resolve(false); };
      m.root.querySelector('[data-yes]').onclick = () => { m.close(); resolve(true); };
    });
  }

  // Very small markdown -> HTML (headings, bold, lists, tables, code, paragraphs).
  function markdown(md) {
    const lines = String(md).split('\n');
    let html = '', inUl = false, inOl = false, tableBuf = [];

    const flushList = () => { if (inUl) { html += '</ul>'; inUl = false; } if (inOl) { html += '</ol>'; inOl = false; } };
    const flushTable = () => {
      if (!tableBuf.length) return;
      const rows = tableBuf.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r));
      html += '<table>';
      rows.forEach((r, i) => {
        const cells = r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const tag = i === 0 ? 'th' : 'td';
        html += '<tr>' + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
      });
      html += '</table>';
      tableBuf = [];
    };
    const inline = (s) =>
      esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.+?)`/g, '<code>$1</code>');

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      if (line.includes('|') && line.split('|').length > 2) { flushList(); tableBuf.push(line); continue; }
      else flushTable();

      if (/^#{1,6}\s/.test(line)) {
        flushList();
        const level = line.match(/^#+/)[0].length;
        html += `<h${Math.min(level, 3)}>${inline(line.replace(/^#+\s/, ''))}</h${Math.min(level, 3)}>`;
      } else if (/^\s*[-*]\s+/.test(line)) {
        if (!inUl) { flushList(); html += '<ul>'; inUl = true; }
        html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
      } else if (/^\s*\d+\.\s+/.test(line)) {
        if (!inOl) { flushList(); html += '<ol>'; inOl = true; }
        html += `<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`;
      } else if (line.trim() === '') {
        flushList();
      } else {
        flushList();
        html += `<p>${inline(line)}</p>`;
      }
    }
    flushList(); flushTable();
    return html;
  }

  return { esc, toast, modal, confirm, markdown };
})();
