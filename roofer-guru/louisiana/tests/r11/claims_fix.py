"""One-off: the claims review's corrections to the bar generator, the documentation and the code comments (round 11)."""
def patch(path, pairs):
    s = open(path, encoding='utf-8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, s.count(a), a[:90])
        s = s.replace(a, b)
    open(path, 'w', encoding='utf-8').write(s)
    print('ok', path)

patch('gen_en.py', [
 ("${x.level >= 3 ? ', gusts near ' + x.gust : ''} · rain about ${x.rain} mm an hour${x.level >= 7 ? (g.surge > 0.05 ? ` · surge drawn ${D(g.surge * 3.281, 0)} ft deep here` : ' · no surge drawn this far from the Gulf') : x.level >= 5 ? ' · surge is drawn from Category 3, near the Gulf' : ''}`; };",
  "${x.level >= 3 ? ', gusts near ' + x.gust : ''} · rain drawn at ${x.rain} mm an hour${x.level >= 7 ? (g.surge > 0.05 ? ` · surge drawn ${D(g.surge * 3.281, 0)} ft deep here (a picture, not a flood map)` : ' · no surge drawn here (the picture\\\\'s edge, not the water\\\\'s)') : x.level >= 5 ? ' · no flood is drawn below Category 3, though such storms bring surge too' : ''}`; };"),
 ("\\'The Alta X does not fly in this weather: it is rated for light rain and no more\\']", "\\'The atlas keeps the Alta X down in this weather: Freefly designs it to withstand light rain (IP43) and publishes no limit beyond that\\']"),
 ("\\'The white object the Nimitz pilots met in 2004: it flies in any weather and warps to an address or coordinates in Louisiana without turning on its side\\']", "\\'Drawn after the white object Navy pilots from the Nimitz reported in 2004; here it flies in any weather and warps to an address or coordinates in Louisiana without turning on its side\\']"),
 ("\\'The classic flying saucer: it flies in any weather, faster the higher it is, and warps to an address or coordinates in Louisiana, standing on its edge first\\']", "\\'Drawn after the classic flying saucer of the 1950s photographs; here it flies in any weather, faster the higher it is, and warps to an address or coordinates in Louisiana, standing on its edge first\\']"),
])
