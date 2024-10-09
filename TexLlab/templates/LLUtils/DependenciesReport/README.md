# Sviluppo tree

## Introduzione
Il file _tree.js_ è scritto con una sintassi di JS recente che non è compatibile con IE11 (perché la [base](https://www.developer.com/design/creating-a-tree-diagram-with-d3-js/) da cui si è partiti è scritta in ES6). Per fare in modo che possa funzionare all'interno del framework di LogicLab, deve essere effettuato il transpiling (traduzione) di questo file ad una sintassi di JS più vecchia.

## Istruzioni
### Installazione Babel
Babel è un package di Node che serve a fare il transpiling.

* Aprire un prompt
* Inizializzare npm col il comando `npm init` e premere invio a tutte le richieste successive. Per fare questo bisogna avere installato Node.js e NPM
* Eseguire il comando
```
npm install --save-dev @babel/core @babel/cli @babel/preset-env
```
per installare Babel e le dipendenze necessarie
* Creare un file `.babelrc` con il contenuto seguente
```json
{
	"presets": [
		[
			// preset to make the compiled JS compatible with IE11
			"@babel/preset-env", {
				"targets": {
					"ie": "11"
				}
			}
		]
	]
}
```
### Compilazione
Il file _tree.js_ verrà "transpilato" in _treeIE.js_, che sarà incluso nell'HTML della pagina.
* Compilare con il comando `npx babel tree.js -o treeIE.js`
* E' possibile settare la compilazione automatica al salvataggio in modo analogo a come spiegato per il [LESS](https://home.axelsw.it/awiki/index.php/LESS#Compilazione_automatica)