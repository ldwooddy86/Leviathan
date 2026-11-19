import sys, re
T='/tmp/claude-0/-home-user-Leviathan/3de4e742-518d-5f10-b5db-2b34e6723642/scratchpad/research/ca/engine_txt/'
keys = ['FAA INFORMATION EFFECTIVE','Elevation:','From city:','Runway ','Dimensions:','Surface:','Traffic pattern:','Runway heading:','Displaced threshold:','Visual slope indicator:','Instrument approach:','Approach lights:','Aircraft operations:','Aircraft based','Statistics','%','Declared distances','Operational restrictions','Helipad']
for a in sys.argv[1:]:
    t=open(T+'airnav_%s.html.txt'%a, encoding='latin-1').read().split('\n')
    print('=====',a, t[0][:90])
    on=False
    for i,l in enumerate(t):
        s=l.strip()
        if s.startswith('Instrument Procedures') or s.startswith('Airport Ownership'):
            pass
        if any(k in s for k in keys) and len(s)<400:
            if s.startswith('Runway ') or 'FAA INFORMATION' in s or 'Elevation' in s or 'Dimensions' in s or 'Traffic pattern' in s or 'Runway heading' in s or 'Displaced' in s or 'Visual slope' in s or 'Instrument approach' in s or 'Aircraft operations' in s or 'From city' in s or 'Surface:' in s or 'Helipad' in s:
                print('  ',s[:260])
        if 'Airport Operational Statistics' in s:
            for x in t[i:i+22]:
                if x.strip(): print('   STAT>',x.strip()[:200])
