/**
 * services/xml/directory.js
 * -------------------------
 * Cisco IP Phone XML builders for directory services.
 *
 * Generates all five CiscoIPPhone XML types:
 *   CiscoIPPhoneDirectory — contact listings
 *   CiscoIPPhoneMenu      — navigation menus
 *   CiscoIPPhoneInput     — user input forms
 *   CiscoIPPhoneText      — status / success / error messages
 *   CiscoIPPhoneExecute   — multi-action (status popup + redirect)
 *
 * All responses are served with Content-Type: text/xml.
 */

/**
 * Build a CiscoIPPhoneDirectory XML response.
 *
 * @param {string} title - Title shown at top of phone screen
 * @param {string} prompt - Subtitle / record count
 * @param {Array<{Name: string, Telephone: string}>} entries - Contact entries
 * @param {Array<{Name: string, URL: string, Position: number}>} softkeys - SoftKeyItem buttons
 * @returns {string} XML string
 */
function directory(title, prompt, entries, softkeys = []) {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<CiscoIPPhoneDirectory>\n`;
  xml += `  <Title>${esc(title)}</Title>\n`;
  xml += `  <Prompt>${esc(prompt)}</Prompt>\n`;
  for (const entry of entries) {
    xml += `  <DirectoryEntry>\n`;
    xml += `    <Name>${esc(entry.Name)}</Name>\n`;
    xml += `    <Telephone>${esc(entry.Telephone)}</Telephone>\n`;
    xml += `  </DirectoryEntry>\n`;
  }
  for (const sk of softkeys) {
    xml += `  <SoftKeyItem>\n`;
    xml += `    <Name>${esc(sk.Name)}</Name>\n`;
    xml += `    <URL>${esc(sk.URL)}</URL>\n`;
    xml += `    <Position>${sk.Position}</Position>\n`;
    xml += `  </SoftKeyItem>\n`;
  }
  xml += `</CiscoIPPhoneDirectory>`;
  return xml;
}

/**
 * Build a CiscoIPPhoneMenu XML response.
 *
 * @param {string} title
 * @param {string} prompt
 * @param {Array<{Name: string, URL: string}>} items - Menu items
 * @returns {string} XML string
 */
function menu(title, prompt, items) {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<CiscoIPPhoneMenu>\n`;
  xml += `  <Title>${esc(title)}</Title>\n`;
  xml += `  <Prompt>${esc(prompt)}</Prompt>\n`;
  for (const item of items) {
    xml += `  <MenuItem>\n`;
    xml += `    <Name>${esc(item.Name)}</Name>\n`;
    xml += `    <URL>${esc(item.URL)}</URL>\n`;
    xml += `  </MenuItem>\n`;
  }
  xml += `</CiscoIPPhoneMenu>`;
  return xml;
}

/**
 * Build a CiscoIPPhoneInput XML response (form).
 *
 * @param {string} title
 * @param {string} prompt
 * @param {Array<{DisplayName: string, QueryStringParam: string, InputFlags: string, DefaultValue: string}>} inputs
 * @param {string} submitUrl - URL the form POSTs/GETs to
 * @param {Array<{Name: string, URL: string, Position: number}>} softkeys
 * @returns {string} XML string
 */
function input(title, prompt, inputs, submitUrl, softkeys = []) {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<CiscoIPPhoneInput>\n`;
  xml += `  <Title>${esc(title)}</Title>\n`;
  xml += `  <Prompt>${esc(prompt)}</Prompt>\n`;
  for (const inp of inputs) {
    xml += `  <InputItem>\n`;
    xml += `    <DisplayName>${esc(inp.DisplayName)}</DisplayName>\n`;
    xml += `    <QueryStringParam>${esc(inp.QueryStringParam)}</QueryStringParam>\n`;
    xml += `    <InputFlags>${esc(inp.InputFlags)}</InputFlags>\n`;
    xml += `    <DefaultValue>${esc(inp.DefaultValue)}</DefaultValue>\n`;
    xml += `  </InputItem>\n`;
  }
  xml += `  <URL>${esc(submitUrl)}</URL>\n`;
  for (const sk of softkeys) {
    xml += `  <SoftKeyItem>\n`;
    xml += `    <Name>${esc(sk.Name)}</Name>\n`;
    xml += `    <URL>${esc(sk.URL)}</URL>\n`;
    xml += `    <Position>${sk.Position}</Position>\n`;
    xml += `  </SoftKeyItem>\n`;
  }
  xml += `</CiscoIPPhoneInput>`;
  return xml;
}

/**
 * Build a CiscoIPPhoneText XML response (status / message).
 *
 * @param {string} title
 * @param {string} text
 * @param {Array<{Name: string, URL: string, Position: number}>} softkeys
 * @returns {string} XML string
 */
function text(title, msg, softkeys = []) {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<CiscoIPPhoneText>\n`;
  xml += `  <Title>${esc(title)}</Title>\n`;
  xml += `  <Text>${esc(msg)}</Text>\n`;
  for (const sk of softkeys) {
    xml += `  <SoftKeyItem>\n`;
    xml += `    <Name>${esc(sk.Name)}</Name>\n`;
    xml += `    <URL>${esc(sk.URL)}</URL>\n`;
    xml += `    <Position>${sk.Position}</Position>\n`;
    xml += `  </SoftKeyItem>\n`;
  }
  xml += `</CiscoIPPhoneText>`;
  return xml;
}

/**
 * Build a CiscoIPPhoneExecute XML response (multi-action).
 *
 * @param {Array<{Priority: number, URL: string}>} actions
 * @returns {string} XML string
 */
function execute(actions) {
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<CiscoIPPhoneExecute>\n`;
  for (const action of actions) {
    xml += `  <ExecuteItem Priority="${action.Priority}" URL="${esc(action.URL)}"/>\n`;
  }
  xml += `</CiscoIPPhoneExecute>`;
  return xml;
}

/**
 * Escape XML special characters.
 */
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

module.exports = { directory, menu, input, text, execute };
