import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from patchlib import patch
patch('31_m17_stock.js', [
 ("Heavy roofs such as tile are exempt, which is why a Los Angeles tile relay permit says cool roof compliance is not required.", "Roofs weighing at least 25 pounds per square foot are exempt, and Los Angeles permits for a tile relay state that cool roof compliance is not required."),
 (" Every new house roof in a fire zone is Class A, and since 2020 nearly every new house carries solar. ${G('A')}`;", " Every new roof in a fire zone must be a Class A assembly. ${G('A')}`;"),
 ("'California Residential Code R908 and R337, Building Code Chapter 7A, Title 24 Part 6 (2022 and 2025 editions)'", "'California Residential Code R908 and R337, Building Code Chapter 7A (the 2025 edition gathers the wildfire rules in Part 7 of Title 24), Title 24 Part 6'"),
])
patch('13_m01_index.js', [
 (" A home improvement contract negotiated mainly in Spanish must be given in Spanish too (Civil Code 1632).`));", "`));"),
 ("Long tenure owners (Proposition 13 keeps them in place) sit on the oldest roofs and have never been through a sale inspection.", "Long tenure owners sit on the oldest roofs and have not been through a buyer's inspection in decades."),
 ("(Building Code Chapter 7A and the residential code\\'s R337).", "(Building Code Chapter 7A and the residential code\\'s R337; Part 7 of Title 24 in the 2025 edition)."),
])
