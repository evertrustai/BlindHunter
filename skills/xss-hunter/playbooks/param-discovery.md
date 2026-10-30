# Parameter Discovery Playbook

## Find parameters
- katana -list live.txt -kf all -o all-urls.txt
- cat all-urls.txt wayback.txt | grep -oP '[\?&]\K[^=]+' | sort -u > params.txt

## Test reflection
- Interlace: for each param, inject test string and check reflection
- Use httpx with custom headers to test each param

## Context detection
- If reflected in HTML tag: use <,>,",'
- If reflected in attribute: break out with ",',`,空格
- If reflected in script tag: use </script>, \\, \/
- If reflected in JS string: use ', ", \\, \n
