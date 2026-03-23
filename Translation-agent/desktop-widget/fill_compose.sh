#!/bin/bash
# fill_compose.sh <target> <subject> <body>
TARGET="$1"
SUBJECT="$2"
BODY="$3"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Slack desktop app — use Accessibility API to write into focused element ──
if [ "$TARGET" = "slack" ]; then
  RESULT=$("$SCRIPT_DIR/ax_insert_text" "$BODY" 2>/dev/null)
  echo "$RESULT"
  exit 0
fi

# ── Gmail — Chrome AppleScript JS injection ───────────────────────────────────
SUBJECT_ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$SUBJECT" 2>/dev/null || echo "")
BODY_ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$BODY" 2>/dev/null || echo "")

JS="(function(){
  var sv=decodeURIComponent('${SUBJECT_ENC}');
  var bv=decodeURIComponent('${BODY_ENC}');

  // Fill subject
  var s=document.querySelector('input[name=\"subjectbox\"]')||document.querySelector('.aoT')||document.querySelector('input[placeholder=\"Subject\"]');
  if(s){
    s.focus();
    var ns=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    ns.call(s,sv);
    s.dispatchEvent(new Event('input',{bubbles:true}));
    s.dispatchEvent(new Event('change',{bubbles:true}));
  }

  // Fill body — try all known Gmail compose body selectors
  var b=document.querySelector('div[aria-label=\"Message Body\"]')
    ||document.querySelector('div[aria-label=\"Message body\"]')
    ||document.querySelector('div[g_editable=\"true\"]')
    ||document.querySelector('div.Am.Al.editable')
    ||document.querySelector('div.Ar.Au div[contenteditable=\"true\"]')
    ||document.querySelector('div[contenteditable=\"true\"][tabindex=\"1\"]')
    ||document.querySelector('div[contenteditable=\"true\"][role=\"textbox\"]');

  if(b){
    b.click();
    b.focus();
    var range=document.createRange();
    range.selectNodeContents(b);
    var sel=window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('insertText',false,bv);
    b.dispatchEvent(new InputEvent('input',{bubbles:true}));
    return 's:'+(s?'ok':'miss')+',b:ok';
  }
  return 's:'+(s?'ok':'miss')+',b:miss';
})()"

osascript - "$JS" << 'ASEOF'
on run argv
  set jsCode to item 1 of argv
  tell application "Google Chrome"
    set tabResult to "no_tab_found"
    repeat with w in windows
      set tabIdx to 1
      repeat with t in tabs of w
        if URL of t contains "mail.google.com" then
          set tabResult to execute t javascript jsCode
          set active tab index of w to tabIdx
          set index of w to 1
          exit repeat
        end if
        set tabIdx to tabIdx + 1
      end repeat
      if tabResult is not "no_tab_found" then exit repeat
    end repeat
    return tabResult
  end tell
end run
ASEOF
