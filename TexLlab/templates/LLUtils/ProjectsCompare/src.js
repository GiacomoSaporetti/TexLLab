const DEBUG = false;

var app = window.external;
var genfuncs = app.CallFunction("common.GetGeneralFunctions");
var m_fso = genfuncs.CreateObject("Scripting.FileSystemObject");
var gentypes = app.CallFunction("common.GetGeneralTypes");

var m_xmlDoc;
var m_fieldsDiffIdx = 1;
var m_fieldsDiffMap = {};
var m_fieldsItemNameMap = {};

// attenzione: sono i valori corrispondenti a quello che c'e' nell'XML
const DIFF_TYPE = {
	DIFFERENT: "different",
	ONLY_LEFT: "onlyLeft",
	ONLY_RIGHT: "onlyRight"
}

// per mostrare le icone sui raggruppamenti
const OBJ_GROUP_ICON_MATCH = {
	"PROGRAM": "icon-program",
	"FUNCTIONBLOCK": "icon-functionblock",
	"INTERFACE": "icon-interface",
	"STRUCT": "icon-struct",
	"MARCO": "icon-marco",
	"SUBRANGE": "icon-subrange",
	"TASK": "icon-tasks",
	"VAR": "icon-vargroup",
	"VARGROUP": "icon-vargroup",
	"FUNCTION": "icon-function",
	"TYPEDEF": "icon-typedef",
	"ENUM": "icon-enum",
	"METHOD": "icon-method",
	"NETWORK": "icon-network"
}

// per mostrare le icone sui rami sottostanti ai raggruppamenti
const OBJ_TYPE_ICON_MATCH = {
	"PROGRAM": "icon-program",
	"FUNCTIONBLOCK": "icon-functionblock",
	"INTERFACE": "icon-interface",
	"STRUCT": "icon-struct",
	"MARCO": "icon-marco",
	"SUBRANGE": "icon-subrange",
	"TASK": "icon-task",
	"VAR": "icon-var",
	"VARGROUP": "icon-vargroup",
	"FUNCTION": "icon-function",
	"TYPEDEF": "icon-typedef",
	"ENUM": "icon-enum",
	"METHOD": "icon-method",
	"NETWORK": "icon-network"
}

// per mostrare con formattazione i nomi degli oggetti
const OBJ_NAME_TO_DISPLAY_NAME = {
	"PROGRAM": app.Translate("Programs"),
	"FUNCTIONBLOCK": app.Translate("Function Blocks"),
	"INTERFACE": app.Translate("Interfaces"),
	"STRUCT": app.Translate("Structures"),
	"MARCO": app.Translate("Macros"),
	"SUBRANGE": app.Translate("Subranges"),
	"TASK": app.Translate("Tasks"),
	"VAR": app.Translate("Variables"),
	"VARGROUP": app.Translate("Variable groups"),
	"FUNCTION": app.Translate("Functions"),
	"TYPEDEF": app.Translate("Typedefs"),
	"ENUM": app.Translate("Enums"),
	"METHOD": app.Translate("Methods"),
	"NETWORK": app.Translate("Networks")
}

// costanti per l'apertura dell'editor delle differenzee
const INI_SECTION_PREFIX = "Settings";
const INI_SETTING_TOOL_NAME = "PrjCompare_Diff_Tool_Name";
const INI_SETTING_TOOL_PARAMETERS = "PrjCompare_Diff_Tool_Parameters";

// query precisa per gli elementi "visibili a occhio"
const BASE_ITEM_QUERY = "children/item";
const PRJ_BASE_QUERY = "compare/item[@type='PROJECT']/children/item[@name='Project']";

function InitPage() {
	// con dark theme vengono usate altre immagini
	let imgPathPrefix = m_darkTheme ? "../img/btn/dark_theme/" : "../img/btn/";

	imgReload.src = csspath + imgPathPrefix + "reload.png";
	imgSettings.src = csspath + imgPathPrefix + "settings.png";
	imgOpen.src = csspath + imgPathPrefix + "open.png";
	imgHelp.src = csspath + imgPathPrefix + "help.png";

	if (m_darkTheme)
		treegrid.classList.add("darkTheme");

	if (DEBUG)
		debugSpan.style.display = "";

	// Attach the fancytree widget to an existing <div id="tree"> element
	// and pass the tree options as an argument to the fancytree() function:
	$("#treegrid").fancytree({
		extensions: ["table"],
		table: {
			indentation: 20,      // indent 20px per node level
			nodeColumnIdx: 0,     // render the node title into the 0 column
		},
		source: [""],		// sembra che non si possa inizializzare senza passare un source perche' solleva un'eccezione
		renderColumns: function(event, data) {
			var node = data.node,
			$tdList = $(node.tr).find(">td");

			// .eq(n) e' sintassi jQuery per prendere l'elemento n
			$tdList.eq(1).text(node.data.otherTitle);
			$tdList.eq(2).text(node.data.diffName);

			if (node.data.showDiffButton) {
				var button = document.createElement('button');
				button.className = "ll-button";
				button.onclick = (function () {
					let fldId = data.node.data.fldId;
					return function () {
						showDiffWindow(fldId);
					}
				})();
				button.title = app.Translate("Show differences for the current item");
				let img = document.createElement("img");
				img.src = m_darkTheme ? "icons\\openWindow_dark.png" : "icons\\openWindow.png";
				button.appendChild(img);
				$tdList.eq(3).append(button);
			}
		},
		dblclick: function(event, data) {
			// serve per farlo espandere cliccando ovunque sulla riga e non solo sulla prima colonna
			var node = data.node;
			if (node.hasChildren()) {
				node.setExpanded(!node.isExpanded());

				event.preventDefault();
			}
		}
	});

	// viene passato in _DATAPATH il path del file contenente risultato della comparazione,
	// al quale devo rimuovere lo / finale che viene settato in automatico da LogicLab
	let path = _DATAPATH.substr(0, _DATAPATH.length - 1);
	LoadXML(path);
}

//#region Debug
function SelectFile() {
	let filePath = app.CallFunction("commonDLL.ShowOpenFileDlg", "XML files (*.xml)|*.xml|All files (*.*)|*.*|",".XML", app.GetApplicationPath() + "..\\UnitTests\\Outputs");
	if (!filePath) return

	LoadXML(filePath);
}
//#endregion

function LoadXML(filePath) {
	if (!m_fso.FileExists(filePath)) {
		app.MessageBox(app.Translate("Error loading Project Compare"), "", gentypes.MSGBOX.MB_ICONERROR);
		app.PrintMessage("Cannot find XML file " + filePath);
		return;
	}

	m_xmlDoc = genfuncs.LoadXML(filePath);
	if (!m_xmlDoc) {
		app.MessageBox(app.Translate("Error loading Project Compare"), "", gentypes.MSGBOX.MB_ICONERROR);
		app.PrintMessage("Cannot load XML file " + filePath);
		return;
	}

	fileNameTxt.value = filePath;

	let otherPrjPath = m_xmlDoc.documentElement.getAttribute("otherPrjPathName");
	otherPrjNameTxt.innerText = otherPrjPath;

	ShowDiffs(m_xmlDoc);
}

function ShowDiffs(xmlDoc) {
	let xmlNode = xmlDoc.selectSingleNode(PRJ_BASE_QUERY);
	// non ci sono differenze!
	if (!xmlNode) {
		app.MessageBox(app.Translate("No differences found"), "", gentypes.MSGBOX.MB_ICONINFORMATION);
		return;
	}

	// di norma e' nascosto
	treegrid.style.display = "";

	let parentNode = [];

	AddToDiffTree(xmlNode, parentNode);

	let tree = $.ui.fancytree.getTree("#treegrid");

	tree.reload(parentNode);

	tree.visit(function(node) {
		if (node.getLevel() === 1) {
			// espande solamente i nodi al primo livello
			node.setExpanded(true);

			// rimuove "different"dai raggruppamenti di primo livello (e' sottinteso che sia diverso)
			node.data.diffName = "";
			node.renderTitle();
			node.triggerModify("rename");

			// rimuove il colore
			node.removeClass("different");
			node.removeClass("onlyLeftRight");
		}
	});

	/**
	 * La funzione costruisce in modo ricorsivo una struttura ad albero che rappresenta le differenze tra due nodi XML, inclusi i campi con valori diversi.
	 * @param xmlNode nodo XML che contiene le informazioni.
	 * @param parentNode Il nodo genitore nell'albero delle differenze a cui il nodo xmlNode corrente verrà aggiunto come figlio.
	 * @param appendChildrenDirectly Un parametro booleano che indica se i nodi figlio devono essere aggiunti direttamente al nodo genitore o se devono essere raggruppati sotto un nuovo nodo dello stesso tipo.
	 */
	function AddToDiffTree(xmlNode, parentNode, appendChildrenDirectly) {
		let xmlChild = xmlNode.selectNodes(BASE_ITEM_QUERY);
		let node;
		while (node = xmlChild.nextNode()) {
			let curNodeType = node.getAttribute("type");

			let curNodeParent;
			if (!appendChildrenDirectly) {
				// ottiene il gruppo corrente
				curNodeParent = parentNode.find(function(item) { return item._rawTitle == curNodeType });
				if (!curNodeParent) {
					// aggiungo il gruppo corrente al parent, se non e' gia' presente
					let diffObj = BuildDiffObj(curNodeType);
	
					if (OBJ_NAME_TO_DISPLAY_NAME[curNodeType])
						diffObj.title = OBJ_NAME_TO_DISPLAY_NAME[curNodeType];
	
					parentNode.push(diffObj);
	
					curNodeParent = diffObj;
				}
			}
			else
				curNodeParent = parentNode;

			let childNodes = node.selectNodes(BASE_ITEM_QUERY);
			// se ha figli vado a cercarli ricorsivamente
			if (childNodes && childNodes.length > 0) {
				// setto il nome dell'oggetto (ad es. una POU) come parent, ovvero faccio scendere il figlio di un livello nella gerarchia
				let newParent = BuildDiffObj(node.getAttribute("name"), node.getAttribute("name"), curNodeType);

				curNodeParent.children.push(newParent);

				curNodeParent = newParent;

				// per i VARGROUP appende i nodi figli direttamente senza raggrupparli sotto a un nodo "Variables"
				AddToDiffTree(node, curNodeParent.children, curNodeType == "VARGROUP");
			}
			else {
				// altrimenti se non ha figli mostro la differenza corrente
				let diffType = node.getAttribute("status");
				let name = node.getAttribute("name");

				let newDiff = BuilDiffObjLeaf(diffType, name, name, curNodeType);

				if (!appendChildrenDirectly)
					curNodeParent.children.push(newDiff);
				else
					curNodeParent.push(newDiff);

				// questo serve per la diff window dei field!
				curNodeParent = newDiff;
			}

			let curDiffFields = [];

			// controllo se nel nodo corrente (che puo' anche avere dei figli) ci sono dei field differenti, che saranno mostrati allo stesso livello dei figli
			let fieldNodes = node.selectNodes("field");
			if (fieldNodes && fieldNodes.length > 0) {
				let fieldNode;
				while (fieldNode = fieldNodes.nextNode()) {
					let curNodeName = fieldNode.getAttribute("name");

					// nel caso di una network nascondo i source code differenti perche', se mostrati come testo, non sono umanamente comprensibili
					if (curNodeName == "sourceCode" && curNodeType == "NETWORK")
						continue;

					let curDiffField = {};
					curDiffField.type = node.getAttribute("type");
					curDiffField.name = curNodeName;

					// per i nodi source code prende i valori da un nodo figlio
					if (curNodeName == "sourceCode") {
						curDiffField.left = genfuncs.GetNode(fieldNode, "value1");
						curDiffField.right = genfuncs.GetNode(fieldNode, "value2");
					}
					else {
						if (!fieldNode.getAttribute("value1")) {
							curDiffField.right = fieldNode.getAttribute("value2");
						}
						else if (!fieldNode.getAttribute("value2")) {
							curDiffField.left = fieldNode.getAttribute("value1");
						}
						else {
							curDiffField.left = fieldNode.getAttribute("value1");
							curDiffField.right = fieldNode.getAttribute("value2");
						}
					}

					curDiffFields.push(curDiffField);
				}

				// conto i numeri di differenze perche', se ho trovato sourceCode delle NETWORK, puo' essere che non ce ne siano
				if (curDiffFields.length > 0) {
					// indice che mi serve per recuperare dalla mappa quando viene effettuato il doppio click
					let idx = m_fieldsDiffIdx++
					curNodeParent.fldId = idx;
					m_fieldsDiffMap[idx] = curDiffFields;
					m_fieldsItemNameMap[idx] = node.getAttribute("name");
	
					// setto il flag per mostrare il bottone che apre la window delle differenze
					curNodeParent.showDiffButton = true;
				}
			}
		}
	}
}

// usata per i rami
function BuildDiffObj(title, title2, iconName) {
	// uso la funzione delle foglie ma aggiungo le property che mi servono
	let diffObj = BuilDiffObjLeaf(DIFF_TYPE.DIFFERENT, title, title2, iconName);
	diffObj.children = [];

	return diffObj;
}

// usata per le foglie
function BuilDiffObjLeaf(diffType, title, title2, iconName) {
	let diffObj = {};

	// e' il titolo vero, cioe' non soggetto a trasformazioni per la visualizzazione finale
	diffObj._rawTitle = title;

	if (diffType == DIFF_TYPE.DIFFERENT) {
		diffObj.title = title;
		diffObj.otherTitle = title2 ? title2 : "";
		diffObj.diffName = app.Translate("Different");
		diffObj.extraClasses = "different";
	}
	else if (diffType == DIFF_TYPE.ONLY_LEFT) {
		diffObj.title = title;
		diffObj.otherTitle = '---';
		diffObj.diffName = app.Translate("Left only");
		diffObj.extraClasses = "onlyLeftRight";
	}
	else if (diffType == DIFF_TYPE.ONLY_RIGHT) {
		diffObj.title = '---';
		diffObj.otherTitle = title;
		diffObj.diffName = app.Translate("Right only");
		diffObj.extraClasses = "onlyLeftRight";
	}

	if (OBJ_GROUP_ICON_MATCH[title])
		diffObj.icon = OBJ_GROUP_ICON_MATCH[title];
	else if (OBJ_TYPE_ICON_MATCH[iconName])
		diffObj.icon = OBJ_TYPE_ICON_MATCH[iconName];

	return diffObj;
}


function showDiffWindow(fldId) {
	if (!m_fieldsDiffMap[fldId])
		return;

	let itemName = m_fieldsItemNameMap[fldId];
	let title = genfuncs.FormatMsg("Differences for '%1'", itemName);

	app.TempVar("ProjectsCompare_fieldDiffs") = JSON.stringify(m_fieldsDiffMap[fldId]);
	app.OpenWindow("LLUtils_ProjectsCompareDiffView", title, "");
}

function openDiffEditorConfig() {
	app.OpenWindow("LLUtils_ProjectsCompareExtDiffToolConfig", app.Translate("Source code comparison settings"), "");
}

function ShowHelp() {
	let msg = app.Translate("In this page, only the differences between the current project and the one selected for comparison are shown. The equal/common parts are not displayed.");
	let msg1 = app.Translate("Differences are highlighted in light blue, while parts present only in one of the two projects are shown in light gray.");
	let msg2 = app.Translate("For items that have a list of differences, a button will be displayed on the right side of the table to open a window listing them.");

	app.MessageBox(msg + "\n\n" + msg1 + "\n" + msg2, "", gentypes.MSGBOX.MB_ICONQUESTION);
}