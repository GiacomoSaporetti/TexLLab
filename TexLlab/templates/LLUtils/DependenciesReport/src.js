

var m_XMLDoc;
var m_POUsMap = {};

const POU_SELECT_EMPTY_VAL = -1;

// uno stack che mi serve per ripristinare la visualizzazione della POU che stavo vedendo in precedenza
var m_pouStack = new Stack();

const POU_TYPES = {
	PROGRAM: 'program',
	FUNCTION: 'function',
	FUNCTION_BLOCK: 'functionBlock',
	TASK: 'task'
}

function InitPage()
{
	// con dark theme vengono usate altre immagini
	let imgPathPrefix = m_darkTheme ? "../img/btn/dark_theme/" : "../img/btn/";

	// imgReload.src = csspath + imgPathPrefix + "reload.png";
	// imgPrint.src = csspath + imgPathPrefix + "print.png";
	imgHelp.src = csspath + imgPathPrefix + "help.png";
	imgBack.src = csspath + imgPathPrefix + "previous.png";

	m_prjPath = app.CallFunction("logiclab.get_ProjectPath");
	m_prjName = m_fso.GetFileName(m_prjPath);

	// imposto qui il titolo per avere i tooltip dei bottoni con la stringa tradotta
	// btnPrint.title = app.Translate("Print");
	// btnReload.title = app.Translate("Reload");
	backBtn.title = app.Translate("Go to the previously selected item");
	helpBtn.title = app.Translate("Show help");

	let prjDir = m_fso.GetParentFolderName(m_prjPath);
	// tolgo l'estensione
	let prjName = m_prjName.substr(0, m_prjName.indexOf('.'));
	let depsXMLFile = prjDir + "\\Build\\" + prjName + DEP_FILE_SUFFIX;

	let res = CheckFileExists(depsXMLFile);
	if (!res) {
		app.PrintMessage(genfuncs.FormatMsg(app.Translate("Could not load dependencies report file \"%1%2\". Enable its generation from the Project Options."), prjName, DEP_FILE_SUFFIX));
		app.CallFunction("extfunct.SelectOutputTab", TAB_RESOURCES);
		return;
	}
	else {
		m_XMLDoc = LoadXMLFile(depsXMLFile);
		LoadData();

		var xmlCodeId = GetXMLCodeId(m_XMLDoc);
		setInterval(ShowUnuFileNotUpdated, 1500, xmlCodeId);
	}

	// per consentire il drag&drop delle POU sulla pagina
	treeView.addEventListener("dragover", function(event) {
		let ok = false;
		if (event.dataTransfer.types.length === 1 && event.dataTransfer.types[0] == "Text")
			ok = true;

		event.dataTransfer.dropEffect = ok ? "copy" : "none";
		// prevent default to allow drop
		if (ok)
			event.preventDefault();
	})

	treeView.addEventListener("drop", function(event) {
		let txt = event.dataTransfer.getData("Text");

		if (m_POUsMap[txt] !== undefined) {
			let SID = m_POUsMap[txt].SID
			POUSelect.value = SID;
			DrawGraph(SID);
		}
		else
			app.MessageBox(app.Translate("Object not found; cannot draw the graph"), "", gentypes.MSGBOX.MB_ICONERROR);
	})

	// toglie il focus dalla select all'apertura della pagina
	document.body.focus();
}

function LoadData() {
	// nodi di primo livello che sono POU e task 	
	let firstLevelNodes = m_XMLDoc.selectNodes("*//pouMap/obj[@type='functionBlock' or @type='program' or @type='function' or @type='task']");
	let node;
	while (node = firstLevelNodes.nextNode()) {
		let currVar = {};

		let name = node.getAttribute('name');
		currVar.SID = node.getAttribute('sid');
		currVar.type = node.getAttribute('type');

		m_POUsMap[name] = currVar;
	}

	FillPOUSelect();
}

function ShowUnuFileNotUpdated(xmlCodeId) {
	let currCodeId = app.CallFunction("logiclab.GetSourceCodeId");

	let isModified = (currCodeId != xmlCodeId) || app.ModifiedFlag;

	if (isModified) {
		var string = pageTitle.innerHTML,
		 substring = "(" + app.Translate("rebuild to update") + ")";
		if (string.indexOf(substring) == -1)
			pageTitle.innerHTML += " (" + app.Translate("rebuild to update") + ")";
	}
	else
		pageTitle.innerHTML = pageTitle.innerHTML.replace("(" + app.Translate("rebuild to update") + ")", "");
}

function CheckFileExists(filePath) {
	let res = m_fso.FileExists(filePath);
	return res;
}

function LoadXMLFile(filePath) {
	return genfuncs.LoadXML(filePath);
}

function GetXMLCodeId(xmldoc) {
	let node = xmldoc.selectNodes("unuObjects")[0];
	if (node)
		return node.getAttribute("sourceCodeID");

	return null;
}

function FillPOUSelect() {
	// inizializzo i diversi gruppi delle POU
	let POUgroups = {};
	for (let POUType in POU_TYPES) {
		POUgroups[POU_TYPES[POUType]] = {};
	}

	// ordino i nomi delle POU
	let POUsNames = Object.keys(m_POUsMap);
	POUsNames.sort();

	// aggiungo in ogni gruppo le POU di quel tipo ordinate
	POUsNames.forEach(function(POUName) {
		let POU = m_POUsMap[POUName];

		POUgroups[POU.type][POUName] = POU;
	});

	let emptyItem = document.createElement('option');
	emptyItem.value = POU_SELECT_EMPTY_VAL;
	emptyItem.innerText = "---";
	POUSelect.appendChild(emptyItem);

	// aggiungo alla select le POU suddivise per gruppi
	for (let POUType in POUgroups) {
		for (let POUName in POUgroups[POUType]) {
			let POU = POUgroups[POUType][POUName];

			let newItem = document.createElement('option');
			newItem.value = POU.SID;
			newItem.innerText = genfuncs.FormatMsg("(%1) %2", GetPOUShortTypeLetter(POU.type), POUName);

			POUSelect.appendChild(newItem);
		}
	}
}

function FindPouInMap(SID) {
	for (let key in m_POUsMap) {
		let element = m_POUsMap[key];
		if (element.SID == SID) {
			// aggiungo attributo col nome
			element.name = key;
			return element;
		}
	}
}

function GetPOUShortTypeLetter(pouType) {
	switch (pouType) {
		case POU_TYPES.FUNCTION:
			return 'F';
		case POU_TYPES.FUNCTION_BLOCK:
			return 'FB';
		case POU_TYPES.PROGRAM:
			return 'P';
		case POU_TYPES.TASK:
			return 'T';
	}
}

function GetPOUColor(pouType) {
	switch (pouType) {
		case POU_TYPES.FUNCTION:
			return 'darkred';
		case POU_TYPES.FUNCTION_BLOCK:
			return 'green';
		case POU_TYPES.PROGRAM:
			return 'blue';
		case POU_TYPES.TASK:
			return 'yellow';
	}
}

/**
 * Disegna il chart di una POU. E' chiamata sia dalla pagina HTML (senza SID come argomento) che dal codice (con SID come argomento)
 * @param {?string} SID se passato il parametro disegna la POU specificata, altrimenti prende il valore della pou selezionata nella select
 */
function DrawGraph(SID) {
	if (!m_XMLDoc)
		return;

	// resetto albero precedente (se esiste)
	document.getElementById('treeView').innerHTML = '';

	if (SID === undefined)
		SID = POUSelect.value;

	if (SID == POU_SELECT_EMPTY_VAL)
		return;

	let depType = document.querySelector('input[name="depType"]:checked').value;
	if (depType == 'depending') {
		var result = FindDependings(SID, GetRoot(SID));
		if (result)
			drawData(result);
	}
	else if (depType == 'dependency') {
		let root = {}
		var result = FindDependencies(SID, root);
		if (result)
			drawData(result);
	}
}

function FindDependencies(sid, tNode) {
	let qry = genfuncs.FormatMsg("/unuObjects/pouMap/obj[@sid='%1']", sid);
	let pouNode = m_XMLDoc.selectSingleNode(qry);

	tNode = {
		name: genfuncs.FormatMsg("(%1) %2", GetPOUShortTypeLetter(pouNode.getAttribute('type')), pouNode.getAttribute('name')),
		value: 4,
		type: GetPOUColor(pouNode.getAttribute('type')),
		_SID: pouNode.getAttribute('sid')
	}

	let childNodes = pouNode.childNodes;
	// se ha figli vado a cercare ricorsivamente
	if (childNodes && childNodes.length > 0) {
		let node;
		while (node = childNodes.nextNode()) {
			let childNodes = FindDependencies(node.getAttribute('sid'), tNode);
			if (childNodes) {
				if (!tNode.children)
					tNode.children = [];
				tNode.children.push(childNodes);
			}
		}
	}

	return tNode;
}

function GetRoot(sid) {
	let qry = genfuncs.FormatMsg("/unuObjects/pouMap/obj[@sid='%1']", sid);
	let pouNode = m_XMLDoc.selectSingleNode(qry);
	let tNode = {
		name: genfuncs.FormatMsg("(%1) %2", GetPOUShortTypeLetter(pouNode.getAttribute('type')), pouNode.getAttribute('name')),
		value: 4,
		type: GetPOUColor(pouNode.getAttribute('type')),
		_SID: pouNode.getAttribute('sid')
	}

	return tNode;
}

function FindDependings(sid, tNode) {
	// cerco gli obj che hanno un figlio dep con quel sid
	let qry = genfuncs.FormatMsg("/unuObjects/pouMap/obj[dep/@sid = '%1']", sid);

	let pouNodes = m_XMLDoc.selectNodes(qry);
	if (!pouNodes || pouNodes.length === 0)
		return tNode;

	let pouNode
	while (pouNode = pouNodes.nextNode()) {
		let newNode = {
			name: genfuncs.FormatMsg("(%1) %2", GetPOUShortTypeLetter(pouNode.getAttribute('type')), pouNode.getAttribute('name')),
			value: 4,
			type: GetPOUColor(pouNode.getAttribute('type')),
			_SID: pouNode.getAttribute('sid')
		}

		let childNodes = FindDependings(pouNode.getAttribute('sid'), newNode);
		if (childNodes) {
			if (!tNode.children)
				tNode.children = [];
			tNode.children.push(childNodes);
		}
		else {
			if (!tNode.children)
				tNode.children = [];
			tNode.children.push(newNode);
		}
	}

	return tNode;
}


// ----------------------------- varie -----------------------------
function ShowHelp() {
	let msg = app.Translate("Choose the item you want to plot from the dropdown menu. You can select 'Dependency' or 'Depending' mode: the first one represent the tree fom the seleced object to its children, while the second option does the opposite.");
	let msg1 = app.Translate("Click a graph node to select it; then you can use the 'Back' button to navigate to the previously selected node.");
	let msg2 = app.Translate("Double click a graph node to open its PLC source inside the code.");
	let msg3 = app.Translate("You can also drag&drop a POU from the IDE to this page to plot its dependencies.");

	app.MessageBox(msg + "\n\n" + msg1 + "\n" + msg2 + "\n\n" + msg3, "", gentypes.MSGBOX.MB_ICONQUESTION);
}


// ----------------------------- gestione dello stack -----------------------------
function Stack() {
	this.items = [];
}

Stack.prototype.push = function(element) {
	this.items.push(element);
}

Stack.prototype.pop = function() {
	// return top most element in the stack
	// and removes it from the stack
	if (this.items.length == 0)
		return;
	return this.items.pop();
}

Stack.prototype.isEmpty = function() {
	// return true if stack is empty
	return this.items.length == 0;
}

Stack.prototype.printStack = function() {
	var str = "";
	for (var i = 0; i < this.items.length; i++)
		str += this.items[i] + "\n";
	str += "-----";
	return str;
}

function NodeClick(SID) {
	// salvo la POU che stavo vedendo prima
	if (SID != POUSelect.value) {
		let curSID = POUSelect.value;
		m_pouStack.push(curSID);
	}

	POUSelect.value = SID;
	DrawGraph(SID);

	backBtn.disabled = m_pouStack.isEmpty();
}

function GoBack() {
	let prevPOU = m_pouStack.pop();

	if (prevPOU) {
		POUSelect.value = prevPOU;
		DrawGraph(prevPOU);
	}

	backBtn.disabled = m_pouStack.isEmpty();
}