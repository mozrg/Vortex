(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  function inline(text) {
    const spans = [];
    const stash = (html) => {
      const token = `\u0000${spans.length}\u0000`;
      spans.push(html);
      return token;
    };
    const raw = text.replace(/\u0000/g, '').replace(/`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_, code, label, href) => {
      if (code !== undefined) return stash(`<code>${escapeHtml(code)}</code>`);
      return stash(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`);
    });
    return escapeHtml(raw).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
      .replace(/\u0000(\d+)\u0000/g, (_, index) => spans[Number(index)] || '');
  }

  const inlineLines = (lines) => lines.map((line, index) => {
    const text = line.trim();
    return inline(index + 1 < lines.length && text.endsWith('\\') ? text.slice(0, -1) : text);
  }).join('<br>');
  const headingMarker = /^ {0,3}(#{1,6})\s+(.+)$/;
  const fenceMarker = /^\s*(`{3,}|~{3,})/;
  const ruleMarker = /^\s*(---+|\*\*\*+|___+)\s*$/;

  const listMarker = (line) => {
    const match = /^(\s*)([-+*]|\d+[.)])\s+(.*)$/.exec(line);
    if (!match) return null;
    return { indent: match[1].replace(/\t/g, '  ').length, ordered: /^\d/.test(match[2]), content: match[3] };
  };

  function parseList(lines, start, indent) {
    const first = listMarker(lines[start]);
    const tag = first?.ordered ? 'ol' : 'ul';
    const chunks = [];
    let index = start;
    while (index < lines.length) {
      const marker = listMarker(lines[index]);
      if (!marker || marker.indent !== indent || marker.ordered !== (tag === 'ol')) break;
      const task = /^\[([ x])\]\s+(.*)$/i.exec(marker.content);
      const contents = [task ? task[2] : marker.content];
      index += 1;
      const parts = [];
      while (index < lines.length) {
        const nextMarker = listMarker(lines[index]);
        if (nextMarker && nextMarker.indent > indent) {
          const parsed = parseList(lines, index, nextMarker.indent);
          if (contents.length) {
            parts.push(inlineLines(contents));
            contents.length = 0;
          }
          parts.push(parsed.html);
          index = parsed.index;
          continue;
        }
        if (nextMarker && nextMarker.indent <= indent) break;
        if (!lines[index].trim()) {
          const nextNonEmpty = lines.slice(index + 1).find((line) => line.trim());
          if (!nextNonEmpty) { index = lines.length; break; }
          const next = listMarker(nextNonEmpty);
          if (!next || next.indent <= indent) break;
          index += 1;
          continue;
        }
        const leading = (lines[index].match(/^\s*/) || [''])[0].replace(/\t/g, '  ').length;
        if (leading <= indent) break;
        contents.push(lines[index]);
        index += 1;
      }
      const taskClass = task ? (task[1] === ' ' ? ' class="task"' : ' class="task done"') : '';
      const taskMark = task ? `<span class="markdown-task-mark">${task[1] === ' ' ? '☐' : '☑'}</span> ` : '';
      if (contents.length) parts.push(inlineLines(contents));
      chunks.push(`<li${taskClass}>${taskMark}${parts.join('')}</li>`);
    }
    return { html: `<${tag}>${chunks.join('')}</${tag}>`, index };
  }

  function renderMarkdown(markdown, { headingOffset = 0 } = {}) {
    const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      const fence = fenceMarker.exec(line);
      if (fence) {
        const code = [];
        const endFence = new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`);
        index += 1;
        while (index < lines.length && !endFence.test(lines[index])) code.push(lines[index++]);
        if (index < lines.length) index += 1;
        blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        continue;
      }
      const heading = headingMarker.exec(line);
      if (heading) { const level = Math.min(6, heading[1].length + headingOffset); blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`); index += 1; continue; }
      if (ruleMarker.test(line)) { blocks.push('<hr>'); index += 1; continue; }
      if (/^\s*>/.test(line)) {
        const quote = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ''));
        blocks.push(`<blockquote><p>${inlineLines(quote)}</p></blockquote>`);
        continue;
      }
      const marker = listMarker(line);
      if (marker) {
        const parsed = parseList(lines, index, marker.indent);
        blocks.push(parsed.html);
        index = Math.max(parsed.index, index + 1);
        continue;
      }
      const paragraph = [line];
      index += 1;
      while (index < lines.length && lines[index].trim()
        && !headingMarker.test(lines[index])
        && !fenceMarker.test(lines[index])
        && !/^\s*>/.test(lines[index])
        && !listMarker(lines[index])
        && !ruleMarker.test(lines[index])) {
        paragraph.push(lines[index]);
        index += 1;
      }
      blocks.push(`<p>${inlineLines(paragraph)}</p>`);
    }
    return blocks.join('');
  }

  window.VortexMarkdown = {
    render(element, markdown, options) { if (element) element.innerHTML = renderMarkdown(markdown, options); },
    toHtml: renderMarkdown
  };
})();
