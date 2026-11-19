#!/usr/bin/env python3
import sys, math
lat,lon,z=float(sys.argv[1]),float(sys.argv[2]),int(sys.argv[3]); n=2**z
print(int((lon+180)/360*n), int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n))
