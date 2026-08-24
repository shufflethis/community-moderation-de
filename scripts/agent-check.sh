#!/usr/bin/env bash
# agent-check.sh <domain> – prüft eine Domain gegen die Punkte, die Is Agentic bewertet.
# Braucht nur curl und python3. Keine Änderungen, nur Lesen.
set -uo pipefail

DOMAIN="${1:-}"
[ -z "$DOMAIN" ] && { echo "Aufruf: $0 example.com"; exit 1; }
BASE="https://${DOMAIN#https://}"; BASE="${BASE%/}"

UA="Mozilla/5.0 (compatible; agent-readiness-check/1.0)"
pass=0; fail=0; warn=0
ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; pass=$((pass+1)); }
no()   { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail+1)); }
meh()  { printf '  \033[33mWARN\033[0m %s\n' "$1"; warn=$((warn+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

get()  { curl -sS -m 20 -A "$UA" "$@"; }
code() { get -o /dev/null -w '%{http_code}' "$@"; }
ctype(){ get -o /dev/null -w '%{content_type}' "$@"; }

# Kanonische Basis bestimmen: Viele Domains leiten vom Apex auf www um. Ohne
# diesen Schritt misst man die Weiterleitungsantwort (text/plain, 301) statt der
# Seite – und bekommt lauter falsche Fehler.
EFFECTIVE=$(get -o /dev/null -L -w '%{url_effective}' "$BASE/")
CANON=$(python3 -c "
import sys
from urllib.parse import urlparse
u=urlparse(sys.argv[1] if len(sys.argv)>1 else '')
print(f'{u.scheme}://{u.netloc}' if u.netloc else '')" "$EFFECTIVE")
if [ -n "$CANON" ] && [ "$CANON" != "$BASE" ]; then
  printf '  \033[36mINFO\033[0m Kanonische Basis: %s (geprüft wird diese)\n' "$CANON"
  BASE="$CANON"
fi

HOME_HTML=$(get -L "$BASE/")

head_ "1 · Erreichbarkeit"
[ "$(code -L "$BASE/")" = "200" ] && ok "Startseite liefert 200" || no "Startseite liefert $(code -L "$BASE/")"
HOPS=$(get -o /dev/null -L -w '%{num_redirects}' "$BASE/")
[ "$HOPS" -le 1 ] && ok "Weiterleitungen: $HOPS" || meh "Weiterleitungskette: $HOPS Sprünge – Agenten brechen früher ab als Browser"
grep -qi 'http-equiv="refresh"' <<<"$HOME_HTML" && no "meta refresh auf der Startseite" || ok "kein meta refresh"
grep -qiE 'cf-browser-verification|just a moment|challenge-platform|captcha' <<<"$HOME_HTML" \
  && no "Bot-Schutz blockt einfache Clients" || ok "kein Bot-Schutz-Wall"
TEXT=$(python3 -c "
import sys,re
h=sys.stdin.read()
for tag in ('script','style','svg','noscript'): h=re.sub(r'<%s[\s\S]*?</%s>'%(tag,tag),' ',h,flags=re.I)
print(len(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',h)).strip()))" <<<"$HOME_HTML")
[ "$TEXT" -gt 1200 ] && ok "Inhalt ohne JavaScript lesbar (${TEXT} Zeichen)" \
  || no "nur ${TEXT} Zeichen im HTML – der Inhalt kommt vermutlich erst per JavaScript"
KB=$(( ${#HOME_HTML} / 1024 ))
[ "$KB" -lt 400 ] && ok "Seitengröße ${KB} kB" || meh "Seitengröße ${KB} kB – zerlegt das Token-Budget eines Agenten"

head_ "2 · Status-Codes"
NF=$(code "$BASE/diese-seite-gibt-es-nicht-$RANDOM")
[ "$NF" = "404" ] || [ "$NF" = "410" ] && ok "unbekannter Pfad liefert $NF" || no "unbekannter Pfad liefert $NF statt 404"
NF_BODY=$(get "$BASE/diese-seite-gibt-es-nicht-$RANDOM")
grep -qiE 'llms\.txt|sitemap' <<<"$NF_BODY" && ok "404-Seite verweist auf Sitemap oder llms.txt" \
  || meh "404-Seite ohne Wiedereinstieg für Agenten"

head_ "3 · Markdown"
MD_CT=$(ctype -H 'Accept: text/markdown' "$BASE/")
grep -qi 'text/markdown' <<<"$MD_CT" && ok "Accept: text/markdown liefert Markdown" \
  || no "Accept: text/markdown liefert $MD_CT"
VARY=$(get -D - -o /dev/null "$BASE/" | grep -i '^vary:' | tr -d '\r')
grep -qi 'accept' <<<"${VARY#*:}" && ok "Vary nennt Accept (${VARY:-keiner})" || no "Vary ohne Accept: ${VARY:-nicht gesetzt}"
HTML_CT=$(ctype -H 'Accept: text/html,application/xhtml+xml,*/*;q=0.8' "$BASE/")
grep -qi 'text/html' <<<"$HTML_CT" && ok "Browser bekommen weiter HTML" || no "Browser bekommen $HTML_CT"
WILD_CT=$(ctype -H 'Accept: */*' "$BASE/")
grep -qi 'text/html' <<<"$WILD_CT" && ok "Accept: */* bleibt HTML" || meh "Accept: */* liefert $WILD_CT – Crawler bekommen die falsche Variante"
for u in "$BASE/index.md" "$BASE/index.html.md"; do
  [ "$(code "$u")" = "200" ] && { ok "Markdown-Fallback unter ${u#$BASE}"; break; }
done
[ "$(code "$BASE/index.md")" = "200" ] || meh "kein .md-Fallback erreichbar"
grep -qiE '<link[^>]+type="text/markdown"' <<<"$HOME_HTML" && ok "rel=alternate auf die Markdown-Fassung" \
  || no "kein <link rel=alternate type=text/markdown>"

head_ "4 · llms.txt"
LLMS_CODE=$(code "$BASE/llms.txt")
if [ "$LLMS_CODE" = "200" ]; then
  LLMS=$(get "$BASE/llms.txt")
  ok "llms.txt vorhanden"
  head -1 <<<"$LLMS" | grep -q '^# ' && ok "beginnt mit H1" || no "erste Zeile ist keine H1"
  grep -qE '^ {0,3}> ' <<<"$LLMS" && ok "Kurzbeschreibung als Blockquote" || meh "keine Zusammenfassung als > Blockquote"
  grep -qiE 'when to use|wann.*einsetzen|best.?fit' <<<"$LLMS" && ok "When-to-use-Abschnitt" || no "kein When-to-use-Abschnitt"
  LINKS=$(grep -oE 'https?://[^ )>`"]+' <<<"$LLMS" | sed 's/[.,;:`]*$//' | sort -u | head -5)
  # 405 heißt: Der Pfad existiert, verlangt aber POST – bei dokumentierten
  # Endpunkten ist das richtig und kein toter Link.
  bad=0; for l in $LINKS; do c=$(code -L "$l"); case "$c" in 200|204|405) ;; *) bad=$((bad+1)); echo "       tot: $l ($c)";; esac; done
  [ "$bad" = "0" ] && ok "Stichprobe der Links auflösbar" || no "$bad tote Links in llms.txt"
  [ "$(code "$BASE/llms-full.txt")" = "200" ] && ok "llms-full.txt vorhanden" || meh "kein llms-full.txt"
else
  no "llms.txt fehlt ($LLMS_CODE)"
fi

head_ "5 · Sitemap, robots, Agent Card"
SM=0
for u in sitemap.xml sitemap-index.xml sitemap_index.xml; do
  [ "$(code "$BASE/$u")" = "200" ] && { ok "Sitemap unter /$u"; SM=1; break; }
done
[ "$SM" = "1" ] || no "keine Sitemap gefunden"
ROBOTS=$(get "$BASE/robots.txt")
# Gruppenweise auswerten: Ein "Disallow: /" unter einem einzelnen Bot (etwa
# Bytespider) ist eine bewusste Entscheidung und kein Fehler. Nur die Gruppen,
# auf die es ankommt, werden geprüft.
BLOCKED=$(ROBOTS="$ROBOTS" python3 -c "
import os, re
groups, current = {}, []
for line in os.environ['ROBOTS'].splitlines():
    line = re.sub(r'#.*', '', line).strip()
    if not line: continue
    key, _, value = line.partition(':')
    key, value = key.strip().lower(), value.strip()
    if key == 'user-agent':
        current = [value.lower()]
        groups.setdefault(value.lower(), [])
    elif key in ('disallow', 'allow') and current:
        for agent in current: groups.setdefault(agent, []).append((key, value))
watch = ['*', 'gptbot', 'claudebot', 'perplexitybot', 'google-extended', 'oai-searchbot']
print(','.join(a for a in watch if any(k == 'disallow' and v == '/' for k, v in groups.get(a, []))))
" 2>/dev/null)
[ -z "$BLOCKED" ] && ok "robots.txt lässt die relevanten Crawler durch" || no "robots.txt sperrt: $BLOCKED"
grep -qi 'sitemap:' <<<"$ROBOTS" && ok "robots.txt nennt die Sitemap" || meh "robots.txt ohne Sitemap-Zeile"
[ "$(code "$BASE/.well-known/agent-card.json")" = "200" ] && ok "Agent Card vorhanden" || meh "keine /.well-known/agent-card.json"

head_ "6 · Strukturierte Daten"
# Über eine Datei statt über Umgebung oder Argument: Große Seiten sprengen sonst
# das Limit für Argumentlisten. Python meldet nur Marker – gezählt und gefärbt
# wird in der Shell, sonst fehlen diese Befunde in der Bilanz.
TMP_HTML=$(mktemp); printf '%s' "$HOME_HTML" > "$TMP_HTML"; trap 'rm -f "$TMP_HTML"' EXIT
SCHEMA_OUT=$(python3 - "$TMP_HTML" <<'PYEOF'
import sys, re, json

html = open(sys.argv[1], encoding='utf-8', errors='replace').read()
blocks = []
broken = False
for raw in re.findall(r'<script[^>]*application/ld\+json[^>]*>([\s\S]*?)</script>', html):
    try:
        data = json.loads(raw)
    except Exception:
        broken = True
        continue
    for item in (data if isinstance(data, list) else [data]):
        # Yoast, RankMath & Co. packen alles in @graph – auffalten, sonst sieht
        # man nur einen Block ohne @type.
        if isinstance(item, dict) and isinstance(item.get('@graph'), list):
            blocks.extend(item['@graph'])
        else:
            blocks.append(item)

if broken:
    print('FAIL|JSON-LD ist kein gültiges JSON')
if not blocks:
    print('FAIL|kein JSON-LD gefunden')
    raise SystemExit

def types_of(block):
    t = block.get('@type') if isinstance(block, dict) else None
    return t if isinstance(t, list) else ([t] if t else [])

names = [' + '.join(types_of(b)) or '(ohne @type)' for b in blocks]
print(f"OK|JSON-LD vorhanden: {', '.join(names)}")
distinct = {n for n in names if n}
print('OK|mehrere Schema-Typen' if len(distinct) > 1 else 'WARN|nur ein Schema-Typ – Breite fehlt')

org = next((b for b in blocks if 'Organization' in types_of(b)), None)
if not org:
    print('FAIL|kein Block mit @type "Organization" (Unterklassen zählen nicht)')
else:
    for field in ('url', 'logo', 'address', 'contactPoint', 'sameAs', 'description'):
        print(f"OK|Organization.{field}" if org.get(field) else f"FAIL|Organization.{field} fehlt")
    points = org.get('contactPoint')
    points = points if isinstance(points, list) else ([points] if points else [])
    if points and all(p.get('contactType') for p in points):
        print('OK|contactPoint mit contactType')
    elif points:
        print('FAIL|contactPoint ohne contactType')
PYEOF
)
while IFS='|' read -r level message; do
  [ -z "$level" ] && continue
  case "$level" in
    OK)   ok   "$message" ;;
    WARN) meh  "$message" ;;
    *)    no   "$message" ;;
  esac
done <<< "$SCHEMA_OUT"

head_ "7 · Vertrauensseiten"
for p in about ueber-uns about-us contact kontakt privacy datenschutz; do
  c=$(code -L "$BASE/$p")
  if [ "$c" = "200" ]; then
    n=$(get -L "$BASE/$p" | python3 -c "
import sys,re
h=sys.stdin.read()
for t in ('script','style','svg','nav','footer','header'): h=re.sub(r'<%s[\s\S]*?</%s>'%(t,t),' ',h,flags=re.I)
print(len(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',h)).strip()))")
    [ "$n" -ge 500 ] && ok "/$p (${n} Zeichen)" || meh "/$p nur ${n} Zeichen – unter 500 zählt es nicht"
  fi
done

head_ "Ergebnis"
printf '  %s bestanden · %s Warnungen · %s Fehler\n\n' "$pass" "$warn" "$fail"
[ "$fail" = "0" ]
