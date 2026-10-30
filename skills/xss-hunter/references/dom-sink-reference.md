# DOM XSS Sink Reference

## Dangerous Sinks
- element.innerHTML = userInput
- element.outerHTML = userInput
- document.write(userInput)
- document.writeln(userInput)
- eval(userInput)
- setTimeout(userInput)
- setInterval(userInput)
- new Function(userInput)
- element.insertAdjacentHTML(userInput)
- jQuery .html() .append() .prepend()

## Safe Alternatives
- element.textContent = userInput
- element.innerText = userInput
- document.createTextNode(userInput)
- element.setAttribute()
- element.classList.add()

## Detection
- Static: grep for innerHTML, document.write, eval
- Dynamic: use DOM invader in Burp
