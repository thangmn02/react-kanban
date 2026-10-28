/** Schema parsing remains the final boundary; strip executable/external paste first. */
export function safeNoteHtml(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('script,style,iframe,object,embed,form,input,button,link,meta,svg,math').forEach(element => element.remove());
  for (const element of document.body.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) if (/^on/i.test(attribute.name) || ['srcdoc', 'style'].includes(attribute.name)) element.removeAttribute(attribute.name);
  }
  for (const image of document.querySelectorAll('img')) {
    if (!/^[0-9a-f-]{36}$/i.test(image.getAttribute('data-kora-note-image') || '')) image.remove();
    else image.removeAttribute('src');
  }
  for (const anchor of document.querySelectorAll('a[href]')) {
    try { if (!['https:', 'http:', 'mailto:'].includes(new URL(anchor.getAttribute('href')!, location.origin).protocol)) anchor.removeAttribute('href'); }
    catch { anchor.removeAttribute('href'); }
  }
  return document.body.innerHTML;
}
