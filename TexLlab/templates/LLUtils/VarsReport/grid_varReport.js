var GRIDNAME = "VARREPORT"
var m_filterCriteria;
m_gridDatapath = app.GetWindowData();

var columns 	 = {	name: 		 0,
						type: 		 1, 
						dataBlock: 	 2, 
						size: 	 	 3, 
						group: 	 	 4, 
						initValue: 	 5, 
						attribute: 	 6,
						descr: 		 7,
						location:	 8
					}

var m_columnsNodes = []

function InitGrid()
{	
	for (var i in columns)
		m_columnsNodes.push(i)

	grid.AddColumn( 150, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Name"));
	grid.AddColumn( 100, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Type"));
	grid.AddColumn( 150, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Address"));
	grid.AddColumn( 80, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Array"));
	grid.AddColumn( 150, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Group"));
	grid.AddColumn( 100, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Init value"));
	grid.AddColumn( 100, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Attribute"));
	grid.AddColumn( 300, 100, true, false, egColumnType.egEdit,  		0, app.Translate("Description"));
	grid.AddColumn( 100, 100, false, false, egColumnType.egEdit,  		0, app.Translate("Location"));
	grid.Init();

	CreateEnums()

	for (let key in IECTypes) {
		let newOpt = document.createElement("option");
		newOpt.innerText = key;
		newOpt.value = key;

		varTypeSel.appendChild(newOpt);
	}

	LoadGridContents(null)
}

const SYM_LOCATION = {
	ALL: "All",
	PROJECT: "Project",
	TARGET: "Target",
	LIBRARY: "Library",
	LOCAL: "Local",
	EMBEDDED: "Embedded",
	AUX: "Aux"
}

// come definito nella select HTML
const VAR_TYPE_ALL = "All";

/**
 * Carica i contenuti della griglia
 * @param {?object} filter le opzioni del filtro (filter criteria)
 */
function LoadGridContents(filter)
{
	var msg = app.Translate("Loading variables...");
	app.CallFunction("commonDLL.ShowWaitDlg", msg);

	if(grid.NumRows > 0)
		grid.DeleteRows(grid.NumRows);

	// ordina per nome di default
	grid.SortByColumn(columns.name, false);

	let varLocationFilter = varLocationSel.value;
	let varTypeFilter = varTypeSel.value;

	m_gridRows = {};
	var counter = 0;

	if (varLocationFilter == SYM_LOCATION.ALL || varLocationFilter == SYM_LOCATION.PROJECT) {
		for (var i = 0, t = m_globalVars.length; i < t; i++)
		{
			var plcVar = m_globalVars.item(i);

			if (!FilterVar(plcVar, filter) || !FilterVarType(plcVar, varTypeFilter))
				continue;
	
			var rowData = BuildRow(plcVar, SYM_LOCATION.PROJECT);
	
			// solo se i filtri corrispondono
			let rowID = counter++;
			m_gridRows[rowID] = rowData;
		}
	}

	if (m_auxVars && (varLocationFilter == SYM_LOCATION.ALL || varLocationFilter == SYM_LOCATION.AUX))
	{
		for (let j = 0, k = m_auxVars.length; j < k; j++)
		{
			var plcVar = m_auxVars.item(j);

			if (!FilterVar(plcVar, filter) || !FilterVarType(plcVar, varTypeFilter))
				continue;

			var rowData = BuildRow(plcVar, SYM_LOCATION.AUX);

			// solo se i filtri corrispondono
			let rowID = counter++;
			m_gridRows[rowID] = rowData;
		}
	}

	if (m_targetVars && (varLocationFilter == SYM_LOCATION.ALL || varLocationFilter == SYM_LOCATION.TARGET))
	{
		for (let j = 0, k = m_targetVars.length; j < k; j++)
		{
			var plcVar = m_targetVars.item(j);

			if (!FilterVar(plcVar, filter) || !FilterVarType(plcVar, varTypeFilter))
				continue;

			var rowData = BuildRow(plcVar, SYM_LOCATION.TARGET);

			// solo se i filtri corrispondono
			let rowID = counter++;
			m_gridRows[rowID] = rowData;
		}
	}

	if (m_libariesVars && (varLocationFilter == SYM_LOCATION.ALL || varLocationFilter == SYM_LOCATION.LIBRARY))
	{
		for (let j = 0, k = m_libariesVars.length; j < k; j++)
		{
			var plcVar = m_libariesVars.item(j);

			if (!FilterVar(plcVar, filter) || !FilterVarType(plcVar, varTypeFilter))
				continue;

			var rowData = BuildRow(plcVar, SYM_LOCATION.LIBRARY);

			// solo se i filtri corrispondono
			let rowID = counter++;
			m_gridRows[rowID] = rowData;
		}
	}

	grid.InsertRows(counter);
	app.CallFunction("commonDLL.CloseWaitDlg");
}

function BuildRow(plcVar, location)
{
	var strArr = plcVar.GetStrDimensions();
	if (!strArr)
		strArr = app.Translate("No");

	var strAttr;
	if (plcVar.Attribute == ATTVAR.CONST)
		strAttr = "CONSTANT";
	else if (plcVar.Attribute == ATTVAR.RETAIN)
		strAttr = "RETAIN";
	else
		strAttr = "---";

	var initValue = plcVar.InitValue;
	if(!initValue && initValue != 0)
		initValue = "";

	let SID = plcVar.GetSID();

	if (location == SYM_LOCATION.LIBRARY)
	{
		// estraggo dal SID il nome della libreria di provenienza. ad esempio "MAIN" nel SID "V:MAIN:VAR_1"
		let matches = SID.match(/:(.*):/);
		if (matches && matches[1])
			location += " (" + matches[1] + ")";
	}

	let newRow = new Object();
	newRow.name			= plcVar.Name;
	newRow.type			= plcVar.Type;
	newRow.dataBlock	= plcVar.DataBlock;
	newRow.size			= strArr;
	newRow.group		= plcVar.Group;
	newRow.initValue	= initValue;
	newRow.attribute	= strAttr;
	newRow.descr		= plcVar.Description;
	newRow.SID			= SID;
	newRow.location		= location;

	return newRow;
}

function FilterVar(plcVar, filter)
{
	if (filter)
	{
		let foundSomethig = false;

		if (filter.findInName && MatchString(plcVar.name, filter.searchText, filter.caseSensitive, filter.wholeWord))
			foundSomethig = true;

		if (filter.findInType && MatchString(plcVar.type, filter.searchText, false, filter.wholeWord))
			foundSomethig = true;

		if (filter.findInGroup && MatchString(plcVar.group, filter.searchText, filter.caseSensitive, filter.wholeWord))
			foundSomethig = true;

		if (filter.findInAttribute && MatchString(plcVar.attribute, filter.searchText, filter.caseSensitive, filter.wholeWord))
			foundSomethig = true;

		if (filter.findInDesc && MatchString(plcVar.description, filter.searchText, filter.caseSensitive, filter.wholeWord))
			foundSomethig = true;

		if (filter.findInAddress && MatchString(plcVar.datablock, filter.searchText, filter.caseSensitive, filter.wholeWord))
			foundSomethig = true;

		return foundSomethig;
	}

	return true;
}

function FilterVarType(plcVar, filterType) {
	let varType = plcVar.type;

	if (filterType && filterType != VAR_TYPE_ALL) {
		// se il filtro e' != da ALL e appartiene a un tipo PLC base, altrimenti e' altro
		if (IECTypes[varType.toUpperCase()] !== undefined)
			return (varType.toUpperCase() == filterType);
		else
			return false;
	}

	return true;
}

function OnUnload()
{
	//GridSaveSettings(grid, GRIDNAME)
}


/**
 * Apre la finestra di ricerca/settings e prende il risultato
 */
function FilterParameters()
{
	// SOLO INPUT per la dialog: criteri attuali di ricerca
	app.TempVar("FindParameters_criteria") = m_filterCriteria;
	// SOLO OUTPUT per la dialog: nuovi criteri. mette subito ad undefined per capire che la dialog ha fatto cancel
	app.TempVar("FindParameters_result") = undefined;

	app.OpenWindow("LLUtils_FindParametersReport", app.Translate("Search filters"), "");

	var result = app.TempVar("FindParameters_result");
	if (!result)
		return;

	m_filterCriteria = result;

	// pulisce tutto per sicurezza e per non lasciare tempvar in giro inutili
	app.TempVar("FindParameters_criteria") = undefined;
	app.TempVar("FindParameters_result") = undefined;

	LoadGridContents(m_filterCriteria);

	//se non c'è "(filtered)" nel titolo lo mette
	var string = pageTitle.innerHTML,
	 substring = "(" + app.Translate("filtered") + ")";
	if (string.indexOf(substring) == -1)
		pageTitle.innerHTML += " (" + app.Translate("filtered") + ")";

	btnClearFilter.style.visibility = "visible";
}

function ClearFilter()
{
	m_filterCriteria = null;
	LoadGridContents(null);
	pageTitle.innerHTML = pageTitle.innerHTML.replace("(" + app.Translate("filtered") + ")", "");

	btnClearFilter.style.visibility = "hidden";
}

/**
 * Verifica se la stringa passata corrisponde ai criteri specificati
 * @param {string} strToCheck la stringa in cui cercare
 * @param {string} strFilter il testo da ricercare nella stringa
 * @param {boolean} caseSens se verificare il case
 * @param {boolean} wholeWord se controllare la corrspondenza di tutta la parola
 * @returns se soddisfa i requisiti specificati
 */
function MatchString(strToCheck, strFilter, caseSens, wholeWord)
{
	if (!caseSens)
	{
		strToCheck = strToCheck.toUpperCase();
		strFilter = strFilter.toUpperCase();
	}

	if (!wholeWord)
	{
		if (strToCheck.indexOf(strFilter) != -1)
			return true;
	}
	else
	{	
		var patt = new RegExp("\\b" + strFilter + "\\b");
		return patt.test(strToCheck);
	}

	return false;
}

function PrintWindow()
{
	// ottiene la variabile di ambiente TEMP
	var shell = genfuncs.CreateObject("WScript.Shell")
	var filename = shell.ExpandEnvironmentStrings("%TEMP%") + "\\LogicLab5_Print.xml"
	var curPageURL = window.location.href;
	var curPath = curPageURL.substr(0, curPageURL.lastIndexOf("/")+1);

	// crea dom xml
	var xmldoc = genfuncs.CreateObject("MSXML2.DOMDocument.6.0")
	xmldoc.appendChild(xmldoc.createProcessingInstruction("xml", "version='1.0' encoding='UTF-8'"))
	xmldoc.appendChild(xmldoc.createProcessingInstruction("xml-stylesheet", "type='text/xsl' href='" + curPath +  "PrintGrid.xslt'"))
	var root = xmldoc.appendChild(xmldoc.createElement("print"));

	var pageNode = xmldoc.createElement("page");

	for (let index in m_gridRows) {
		let rowData = m_gridRows[index];

		var nodeNew = xmldoc.createElement("var");

		// settaggio attributi: ATTENZIONE l'ordine sarà quello visualizzato
		nodeNew.setAttribute("name", rowData.name);
		nodeNew.setAttribute("type", rowData.type);
		nodeNew.setAttribute("address", rowData.dataBlock);
		nodeNew.setAttribute("array", rowData.size);
		nodeNew.setAttribute("group", rowData.group);
		nodeNew.setAttribute("initValue", rowData.initValue);
		nodeNew.setAttribute("attribute", rowData.attribute);
		nodeNew.setAttribute("description", rowData.descr);
		pageNode.appendChild(nodeNew);
	}

	pageNode.setAttribute("title", m_prjName + " - Global Variables Report");
	let date = new Date();
	pageNode.setAttribute("date", date.toLocaleDateString() + " - " + date.toLocaleTimeString());
	root.appendChild(pageNode);

	// salva su file l'xml + stylesheet, la trasformazione sarà fatta dal browser
	try
	{
		xmldoc.save(filename)
	}
	catch (e)
	{
		app.MessageBox(app.Translate("Error saving temporary XML printing file to ") + filename + " :\n" + e.description, "", gentypes.MSGBOX.MB_ICONERROR)
		return true
	}

	// apre la finestra modale ridimensionabile, passando il path tramite variabile temporanea
	app.TempVar("PrintGrid_FileName") = filename
	app.OpenWindow("LLUtils_PrintGridReport", app.Translate("Print preview"), "")
	return true

}