import sys, re, html
from html.parser import HTMLParser

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript', 'svg'):
            self.skip += 1
        if tag in ('p', 'br', 'div', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'table', 'section', 'article'):
            self.out.append('\n')
        if tag in ('td', 'th'):
            self.out.append(' | ')
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript', 'svg'):
            self.skip = max(0, self.skip - 1)
        if tag in ('p', 'div', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'table'):
            self.out.append('\n')
    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)

def main():
    path = sys.argv[1]
    raw = open(path, 'rb').read()
    try:
        s = raw.decode('utf-8')
    except UnicodeDecodeError:
        s = raw.decode('latin-1')
    p = P()
    p.feed(s)
    t = ''.join(p.out)
    t = re.sub(r'[ \t\r\f\v]+', ' ', t)
    t = re.sub(r'\n\s*\n+', '\n', t)
    sys.stdout.write(t.strip() + '\n')

main()
