(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  function inline(text) {
    const code = [];
    let output = escapeHtml(text).replace(/`([^`]+)`/g, (_, value) => {
      const token = `\u0000${code.length}\u0000`;
      code.push(`<code>${value}</code>`);
      return token;
    });
    output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_, label, href) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`);
    output = output.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
    return output.replace(/\u0000(\d+)\u0000/g, (_, index) => code[Number(index)] || '');
  }

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
      let item = inline(marker.content);
      index += 1;
      const nested = [];
      const continuation = [];
      while (index < lines.length) {
        const nextMarker = listMarker(lines[index]);
        if (nextMarker && nextMarker.indent > indent) {
          const parsed = parseList(lines, index, nextMarker.indent);
          nested.push(parsed.html);
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
        continuation.push(lines[index].trim());
        index += 1;
      }
      if (continuation.length) item += `<br>${inline(continuation.join(' '))}`;
      chunks.push(`<li>${item}${nested.join('')}</li>`);
    }
    return { html: `<${tag}>${chunks.join('')}</${tag}>`, index };
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
    const blocks = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }
      if (/^\s*```/.test(line)) {
        const code = [];
        index += 1;
        while (index < lines.length && !/^\s*```/.test(lines[index])) code.push(lines[index++]);
        if (index < lines.length) index += 1;
        blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        continue;
      }
      const heading = /^(#{1,3})\s+(.+)$/.exec(line);
      if (heading) { const level = heading[1].length; blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`); index += 1; continue; }
      if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) { blocks.push('<hr>'); index += 1; continue; }
      if (/^\s*>/.test(line)) {
        const quote = [];
        while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ''));
        blocks.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
        continue;
      }
      const marker = listMarker(line);
      if (marker) {
        const parsed = parseList(lines, index, marker.indent);
        blocks.push(parsed.html);
        index = Math.max(parsed.index, index + 1);
        continue;
      }
      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length && lines[index].trim()
        && !/^(#{1,3})\s+/.test(lines[index])
        && !/^\s*```/.test(lines[index])
        && !/^\s*>/.test(lines[index])
        && !listMarker(lines[index])
        && !/^\s*(---+|\*\*\*+|___+)\s*$/.test(lines[index])) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
    }
    return blocks.join('');
  }

  window.VortexMarkdown = {
    render(element, markdown) { if (element) element.innerHTML = renderMarkdown(markdown); },
    toHtml: renderMarkdown
  };
})();
