#!/bin/bash
UA="ultreia-route-builder/0.1 (camino walk tracker)"
RAW=/home/user/ultreia/scripts/raw
M=https://overpass.kumi.systems/api/interpreter
ok(){ python3 -c "import json,sys;d=json.load(open('$1'));assert 'elements' in d" 2>/dev/null; }
# Step 1: way ids of the Central inside each box (cheap: ids only)
for box in "41.10,-8.75,42.06,-8.50" "42.02,-8.75,42.90,-8.40"; do
  tag=$(echo $box | tr ',' '_')
  f=$RAW/central-ids-$tag.json
  if ! ok "$f"; then
    for a in 1 2 3 4 5; do
      curl -sS --max-time 240 -A "$UA" -G "$M" --data-urlencode "data=[out:json][timeout:200];rel(7684546);way(r)($box);out ids;" -o "$f"
      if ok "$f"; then echo "ok ids $box $(wc -c < $f)B"; break; else echo "retry ids $box ($a)"; sleep $((a*20)); fi
    done
  fi
  # Step 2: geometry in chunks of 150 ids
  python3 - "$f" "$RAW/central-chunks-$tag" <<'PY'
import json,sys,os
d=json.load(open(sys.argv[1])); ids=[e['id'] for e in d['elements'] if e['type']=='way']
os.makedirs(sys.argv[2],exist_ok=True)
for i in range(0,len(ids),150):
    open(f"{sys.argv[2]}/chunk-{i//150:03d}.ids","w").write(",".join(map(str,ids[i:i+150])))
print("ways in box:",len(ids),"chunks:",(len(ids)+149)//150)
PY
  for c in $RAW/central-chunks-$tag/*.ids; do
    out=${c%.ids}.json
    if ok "$out"; then continue; fi
    ids=$(cat $c)
    for a in 1 2 3 4 5; do
      curl -sS --max-time 240 -A "$UA" -X POST "$M" --data-urlencode "data=[out:json][timeout:200];way(id:$ids);out geom;" -o "$out"
      if ok "$out"; then echo "ok $(basename $out) $(wc -c < $out)B"; break; else echo "retry $(basename $out) ($a)"; sleep $((a*20)); fi
    done
    sleep 5
  done
done
echo DONE
# Costa ways along the Minho (Caminha → Valença link) for the inland fork
f=$RAW/6100606_41.86_-8.86_42.05_-8.62.json
if ! ok "$f"; then
  for a in 1 2 3 4 5; do
    curl -sS --max-time 240 -A "$UA" -G "$M" --data-urlencode "data=[out:json][timeout:200];rel(6100606);way(r)(41.86,-8.86,42.05,-8.62);out geom;" -o "$f"
    if ok "$f"; then echo "ok minho $(wc -c < $f)B"; break; else echo "retry minho ($a)"; sleep $((a*20)); fi
  done
fi
echo ALLDONE
