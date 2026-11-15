import json, sys, urllib.request, urllib.parse, time
# DNS over HTTPS (dns.google): A + CNAME chain for apex and www
def q(name, t):
    u = "https://dns.google/resolve?" + urllib.parse.urlencode({"name": name, "type": t})
    req = urllib.request.Request(u, headers={"User-Agent": "OmegaWeapon/1.0 (declared site-audit bot)"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=15))
    except Exception as e:
        return {"error": str(e)}
out = []
for d in [l.strip() for l in open(sys.argv[1]) if l.strip() and not l.startswith('#')]:
    row = {"domain": d}
    for h in (d, "www." + d):
        r = q(h, "A"); ans = r.get("Answer", [])
        row[h] = {"status": r.get("Status"), "cname": [a["data"] for a in ans if a.get("type") == 5], "a": [a["data"] for a in ans if a.get("type") == 1]}
    ns = q(d, "NS"); row["ns"] = [a["data"] for a in ns.get("Answer", []) if a.get("type") == 2]
    out.append(row)
    w = row["www." + d]; a = row[d]
    plat = "scorpcloud" if any("scorpcloud" in c for c in w["cname"] + a["cname"]) else ("pantheon" if any("pantheon" in c for c in w["cname"]) else "")
    print("%-34s apexA=%-32s wwwCNAME=%-44s NS=%s %s" % (d, ",".join(a["a"])[:32] or ("NX" if a["status"]==3 else "-"), ",".join(w["cname"])[:44], ",".join(row["ns"])[:60], plat))
    time.sleep(0.2)
json.dump(out, open(sys.argv[2], "w"), indent=1)
