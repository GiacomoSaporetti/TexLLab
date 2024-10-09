// -------------- SCRIPT CON FUNZIONI COMUNI DI UTILITA' DA INCLUDERE NELLE PAGINE HTML ----------------

var app = window.external

// import funzioni da estensione common
var genfuncs = app.CallFunction("common.GetGeneralFunctions")
var gentypes = app.CallFunction("common.GetGeneralTypes")
var ParseBoolean = genfuncs.ParseBoolean
var GetNode = genfuncs.GetNode
var GetNodeText = genfuncs.GetNodeText
var SetNode = genfuncs.SetNode
var toHex = genfuncs.toHex
var GetLastPathElement = genfuncs.GetLastPathElement
var FormatMsg = genfuncs.FormatMsg
var ArrayIndexOf = genfuncs.ArrayIndexOf
var ArrayToMap = genfuncs.ArrayToMap
var MapToArray = genfuncs.MapToArray



var egColumnType = { egCombo: 0, egEdit: 1, egComboOpt: 2, egEditOpt: 3, egOption: 4, egButton: 5, egCheckbox: 6, eg3StateCheckbox: 7, egMix: 8, 
					 egComboText: 9, egComboEdit: 10, egComboTextEdit: 11 }

var IECTypes = { BOOL: 0, SINT: 1, USINT: 2, INT: 3, UINT: 4, DINT: 5, UDINT: 6, LINT: 7, ULINT: 8, REAL: 9, LREAL: 10, BYTE: 11, WORD: 12, DWORD: 13, STRING: 14, LWORD: 15 }

var IECTypesNames = [
		IECTypes.BOOL, "BOOL",
		IECTypes.SINT, "SINT",  IECTypes.USINT, "USINT", 
		IECTypes.INT,  "INT",   IECTypes.UINT,  "UINT", 
		IECTypes.DINT, "DINT",  IECTypes.UDINT, "UDINT", 
		IECTypes.LINT, "LINT",  IECTypes.ULINT, "ULINT", 
		IECTypes.REAL, "REAL",  IECTypes.LREAL, "LREAL", 
		IECTypes.BYTE, "BYTE",  IECTypes.WORD,  "WORD",  IECTypes.DWORD, "DWORD",  IECTypes.LWORD, "LWORD",
		IECTypes.STRING, "STRING"
]


var XPATH_PARENTDEVICE = "(ancestor::*[@insertable])[last()]"
var XPATH_PARENT = XPATH_PARENTDEVICE
var XPATH_ROOTDEVICE = "(ancestor::*[@IsRootDevice])[last()]"


var featUndoEnable = 1


var m_prevTab = 1

function ChangeTab(num)
{
	ShowElem("page" + m_prevTab, false)
	ShowMenu("tab" + m_prevTab, false)
	ShowElem("page" + num, true)
	ShowMenu("tab" + num, true)
	m_prevTab = num
}

function ShowElem(name, state)
{
	document.getElementById(name).style.display = state ? "" : "none"
}

function ShowMenu(name, state)
{
	document.getElementById(name).className = state ? "menu_on" : "menu_off"
}



function SearchError(datapath, xmlmatching)
{
	if (datapath.substr(datapath.length-1,1) != "/")
		datapath += "/"
		
	// ottiene il path COMPLETO del nodo xml in errore, esce se non presente
	var errorPath = app.TempVar("ErrorPath")
	if (! errorPath) return
	
	// scorre l'elenco di tutti gli input della pagina
	var inputList = document.getElementsByTagName("input")
	var i, name, pos

	for (i = 0; i < inputList.length; i++)
		if (inputList[i].name.slice(0, 3) == ".D(")
		{
			// ottiene il path relativo dei dati di questo input partendo dal name se del tipo ".D(...)"
			name = inputList[i].name.slice(3, -1)
			pos = name.indexOf(",")
			if (pos != -1)
				name = name.slice(0, pos)
			
			var match = false
			
			if (xmlmatching)
			{
				// estrae il nodo e ricostruisce il datapath
				var nodes = app.SelectNodesXML(datapath + name)
				if (nodes.length != 0)
				{
					var path = app.GetDataPathFromNode(nodes[0])
					if (path == errorPath)
						match = true
				}
			}
			else			
				// concatena il datapath della pagina con quello dell'input attuale e vede se coincide
				if (datapath + name == errorPath)
					match = true
			
			if (match)
			{
				// ok trovato input che matcha
				inputList[i].className += " CompilerError"
				//elimina indicativo errore
				app.TempVar("ErrorPath") = undefined
			}
		}
}

function SearchErrorTable(grid, gridDatapath, columnsNodes, xmlmatching)
{
	var gridErrorPos = {row: -1, col: -1 }
	
	// gestione evidenziamento errore
	var errorPath = app.TempVar("ErrorPath")
	if (!errorPath)
		return gridErrorPos
		
	var match = false
	
	if (gridDatapath.substr(gridDatapath.length-1) == "/")
		// se il path finisce con "/" lo rimuove
		gridDatapath = gridDatapath.substr(0, gridDatapath.length-1)
	else if (gridDatapath.substr(gridDatapath.length-2) == "/.")
		// se il path finisce con "/." lo rimuove
		gridDatapath = gridDatapath.substr(0, gridDatapath.length-2)
	
	if (xmlmatching)
	{
		// estrae il nodo e ricostruisce il datapath
		var nodes = app.SelectNodesXML(gridDatapath)
		if (nodes.length != 0)
		{
			var path = app.GetDataPathFromNode(nodes[0])
			if (path == errorPath)
				match = true
		}
	}
	else
		// concatena il datapath della pagina con quello dell'input attuale e vede se coincide
		if (gridDatapath == errorPath)
			match = true
	
	if (match)
	{
		gridErrorPos.row = app.TempVar("ErrorRow")
		gridErrorPos.col = app.TempVar("ErrorCol")
		if (gridErrorPos.col != undefined)
		{
			var found = false
			// converte la posizione della colonna in errore da nome nodo a numero colonna
			for (var i = 0; i < columnsNodes.length; i++)
				if (columnsNodes[i] == gridErrorPos.col)
				{
					gridErrorPos.col = i
					found = true
					break
				}
				
			if (!found)
				gridErrorPos.col = -1
		}
		
		if (gridErrorPos.row != undefined && gridErrorPos.row >= 0)
		{
			grid.EditMode(false)
			var r = grid.GetRealRow(gridErrorPos.row)
			var c = gridErrorPos.col != -1 ? gridErrorPos.col : 0
			
			// cerca di determinare se siamo su uno slot, vedendo se è definita la funzione SearchErrorSlot (da slot.js) ed esiste la mappa m_tabsMap
			var isSlot = typeof SearchErrorSlot == "function" && typeof m_tabsMap == "object"
			if (!isSlot)
				grid.Move(r, c)
			else
				// se su slot si posiziona sulla riga in errore con una chiamata ritardata, per dare il tempo alla griglia di inizializzarsi in quanto nascosta
				setTimeout( function(){ grid.Move(r, c) }, 0)
			
			if (gridErrorPos.col != -1)
				grid.SetCellColor(gridErrorPos.row, gridErrorPos.col, 0x0000FF)
		}
		
		//elimina indicativo errore
		app.TempVar("ErrorPath") = undefined
	}
	
	return gridErrorPos
}

// restituisce l'id numerico di un tipo iec
function GetIECType(typename)
{
	var i
	var t = IECTypesNames.length / 2
	for (i = 0; i < t; i++)
		if (typename == IECTypesNames[i*2 + 1])
			return IECTypesNames[i*2]
	
	return -1
}

// cancellazione linee multiple da una griglia generica
function grid_DeleteMultiple(grid, gridDatapath)
{
	if (grid.NumRows == 0) return
	
	app.SaveUndoSnapshot()
	app.Feature(featUndoEnable) = false
	
	var selectionsArr = grid.GetSelections()
	if (selectionsArr != undefined)
	{
		var list = VBArray(selectionsArr).toArray()
		if (list.length > 0)
		{
			// ok multiselezione ON
			for (var i = list.length - 1; i >= 0; i--)
			{
				var row = list[i] + 1
				app.DataDelete(gridDatapath + "/*[" + row + "]", 0)
			}
			grid.DeleteRows(list.length)
			app.Feature(featUndoEnable) = true
			return
		}
	}
	
	// multiselezione OFF, linea singola
	var row = grid.SelectedRow + 1
	app.DataDelete(gridDatapath + "/*[" + row + "]", 0)
	grid.DeleteRows(1)
	app.Feature(featUndoEnable) = true
}

function SetGridTempVars(grid, row, col, datapath, rowTemplate, columns, getNewValueFunc, getCurValueFunc, logPastedRows)
{
	app.TempVar("CurrentGrid") = grid
	app.TempVar("CurrentGrid_row") = row
	app.TempVar("CurrentGrid_col") = col
	app.TempVar("CurrentGrid_dataPath") = datapath
	app.TempVar("CurrentGrid_rowTemplate") = rowTemplate
	app.TempVar("CurrentGrid_columns") = columns
	app.TempVar("CurrentGrid_getNewValueFunc") = getNewValueFunc
	app.TempVar("CurrentGrid_getCurValueFunc") = getCurValueFunc
	app.TempVar("CurrentGrid_logPastedRows") = logPastedRows
}

// stessa di sopra ma con parametri passati come property di un oggetto; alla lunga lista di parametri opzionali diventa inusabile
function SetGridTempVarsOpt(params)
{
	app.TempVar("CurrentGrid") = params.grid
	app.TempVar("CurrentGrid_row") = params.row
	app.TempVar("CurrentGrid_col") = params.col
	app.TempVar("CurrentGrid_dataPath") = params.datapath
	app.TempVar("CurrentGrid_rowTemplate") = params.rowTemplate
	app.TempVar("CurrentGrid_columns") = params.columns
	app.TempVar("CurrentGrid_getNewValueFunc") = params.getNewValueFunc
	app.TempVar("CurrentGrid_getCurValueFunc") = params.getCurValueFunc
	app.TempVar("CurrentGrid_logPastedRows") = params.logPastedRows
	app.TempVar("CurrentGrid_selectNodesFunc") = params.selectNodesFunc
	app.TempVar("CurrentGrid_addTemplateDataFunc") = params.addTemplateDataFunc
	app.TempVar("CurrentGrid_deleteRowFunc") = params.deleteRowFunc
	app.TempVar("CurrentGrid_dataPathFilterString") = params.datapathFilterString
}

function ClearGridTempVars()
{
	app.TempVar("CurrentGrid") = undefined
	app.TempVar("CurrentGrid_row") = undefined
	app.TempVar("CurrentGrid_col") = undefined
	app.TempVar("CurrentGrid_dataPath") = undefined
	app.TempVar("CurrentGrid_rowTemplate") = undefined
	app.TempVar("CurrentGrid_columns") = undefined
	app.TempVar("CurrentGrid_getNewValueFunc") = undefined
	app.TempVar("CurrentGrid_getCurValueFunc") = undefined
	app.TempVar("CurrentGrid_logPastedRows") = undefined
	app.TempVar("CurrentGrid_selectNodesFunc") = undefined
	app.TempVar("CurrentGrid_addTemplateDataFunc") = undefined
	app.TempVar("CurrentGrid_deleteRowFunc") = undefined
	app.TempVar("CurrentGrid_dataPathFilterString") = undefined
}

function ShowGridPopup(grid, row, col, x, y, datapath, rowTemplate, menuName, columns, getNewValueFunc, getCurValueFunc, logPastedRows)
{
	SetGridTempVars(grid, row, col, datapath, rowTemplate, columns, getNewValueFunc, getCurValueFunc, logPastedRows)
	
	if (!menuName)
	{
		// menu di default da mostrare
		if (datapath && rowTemplate)
			// nuovo menu con anche il taglia
			menuName = "gridPopup"
		else
			// vecchio menu senza taglia
			menuName = "gridPopup_NoCut"
	}
	
	var result = app.ShowPopupMenu(menuName, x, y)
	
	// pulizia di tutte le variabili temporanee
	ClearGridTempVars()
	
	return result
}

function ShowGridPopupOpt(menuName, x, y, params)
{
	SetGridTempVarsOpt(params)
	var result = app.ShowPopupMenu(menuName, x, y)
	ClearGridTempVars()
	return result
}

// da AxEditGrid\AxEditGridCtrl.h
var GridSortSpecialFunc =
{
	byDatablockNum: 0,
	byDatablockFull: 1,
	byStringCaseSens: 2
}

// memorizza lo stato di ordinamento della griglia
function GridSort(grid, datapath, col, sortFunc)
{
	var oldcol = app.TempVar("GridSortColumn_" + datapath)
	var inverted = app.TempVar("GridSortInverted_" + datapath)
	
	if (inverted == undefined)
		inverted = false       // primo ordinamento, direzione crescente
	else if (col == oldcol)
		inverted = !inverted   // click successivo e stessa colonna, inverte
	
	if (typeof sortFunc == "function")
		grid.SortByColumnWithJSFunc(col, inverted, sortFunc);
	else if (typeof sortFunc == "number")
		grid.SortByColumnWithSpecialFunc(col, inverted, sortFunc);
	else
		grid.SortByColumn(col, inverted);
	
	if (col == -1)
	{
		// se nessun ordinamento mette la variabile a undefined per eliminarla
		col = undefined
		inverted = undefined
	}
	app.TempVar("GridSortColumn_" + datapath) = col
	app.TempVar("GridSortInverted_" + datapath) = inverted
}

// ripristina lo stato di ordinamento della griglia
function RestoreGridSort(grid, datapath)
{
	var col = app.TempVar("GridSortColumn_" + datapath)
	var inverted = app.TempVar("GridSortInverted_" + datapath)
	if (col != undefined)
		grid.SortByColumn(col, inverted)
}

// gestione tasti speciali da AxEditGrid
var SPECIALEVENT_COPY = 0
var SPECIALEVENT_CUT = 1
var SPECIALEVENT_PASTE = 2
var SPECIALEVENT_CTRL_UP = 3
var SPECIALEVENT_CTRL_DOWN = 4

function GridSpecialEvent(id, param, grid, datapath, rowTemplate, columns, getNewValueFunc, getCurValueFunc, logPastedRows)
{
	SetGridTempVars(grid, undefined, undefined, datapath, rowTemplate, columns, getNewValueFunc, getCurValueFunc, logPastedRows)
	
	var isGFNet = app.GetApplicationPath().toUpperCase().indexOf("GF_NET") != -1
	if (isGFNet)
		// in attesa di utilizzare anche in GF_Net l'extension common !
		switch (id)
		{
			case SPECIALEVENT_COPY:      app.CallFunction("script.GridCopy");     break   // ctrl+c
			case SPECIALEVENT_CUT:       app.CallFunction("script.GridCut");      break   // ctrl+x
			case SPECIALEVENT_PASTE:     app.CallFunction("script.GridPaste");    break   // ctrl+v
			case SPECIALEVENT_CTRL_UP:   app.CallFunction("script.GridMoveUp");   break   // ctrl+up
			case SPECIALEVENT_CTRL_DOWN: app.CallFunction("script.GridMoveDown"); break   // ctrl+down
		}
	else
		switch (id)
		{
			case SPECIALEVENT_COPY:      app.CallFunction("common.GridCopy");     break   // ctrl+c
			case SPECIALEVENT_CUT:       app.CallFunction("common.GridCut");      break   // ctrl+x
			case SPECIALEVENT_PASTE:     app.CallFunction("common.GridPaste");    break   // ctrl+v
			case SPECIALEVENT_CTRL_UP:   app.CallFunction("common.GridMoveUp");   break   // ctrl+up
			case SPECIALEVENT_CTRL_DOWN: app.CallFunction("common.GridMoveDown"); break   // ctrl+down
		}
	
	ClearGridTempVars()
}

function GridSpecialEventOpt(id, eventparam, params)
{
	SetGridTempVarsOpt(params)
	
	switch (id)
	{
		case SPECIALEVENT_COPY:      app.CallFunction("common.GridCopy");     break   // ctrl+c
		case SPECIALEVENT_CUT:       app.CallFunction("common.GridCut");      break   // ctrl+x
		case SPECIALEVENT_PASTE:     app.CallFunction("common.GridPaste");    break   // ctrl+v
		case SPECIALEVENT_CTRL_UP:   app.CallFunction("common.GridMoveUp");   break   // ctrl+up
		case SPECIALEVENT_CTRL_DOWN: app.CallFunction("common.GridMoveDown"); break   // ctrl+down
	}
	
	ClearGridTempVars()
}




// save/load settaggi griglie (larghezza colonne)
var INI_GRIDSETTINGS_PREFIX = "GridSettings_"
var INI_COLWIDTH_PREFIX = "ColWidth"

var m_gridColumnsChanged = false

function GridGetSavedColumnSettings(gridName, colNum)
{
    var column = {}
    column.width = app.ReadINIString(INI_GRIDSETTINGS_PREFIX + gridName, INI_COLWIDTH_PREFIX + colNum, "-1")
	if ( column.width == "-1" )
		column.hidden = "-1"
	else
		column.hidden = parseInt( column.width ) == 0
    
    return column
}

function GridLoadSettings(grid, gridName)
{
	for (var i = 0; i < grid.NumCols; i++)
	{
		var width = app.ReadINIString(INI_GRIDSETTINGS_PREFIX + gridName, INI_COLWIDTH_PREFIX + i, "-1")
		if (width == -1)
			return   // se valore non trovato in ini esce subito, inutile proseguire a cercare anche le altre colonne

		// imposta la dimensione della colonna letta da file solo se la colonna non è già nascosta
		if (grid.ColWidth(i) != 0)
			grid.ColWidth(i) = width
	}
}



function GridSaveSettings(grid, gridName, originalColumnsWidth)
{
	// effettua salvataggio solo se le colonne sono effettivamente state modificate
	if (!m_gridColumnsChanged)
		return
	
	for (var i = 0; i < grid.NumCols; i++)
	{
		// se la colonna era originariamente nascosta non ne salva la dimensione
		if (originalColumnsWidth && originalColumnsWidth[i] == 0)
			continue

		var width = grid.ColWidth(i)
		app.WriteINIString(INI_GRIDSETTINGS_PREFIX + gridName, INI_COLWIDTH_PREFIX + i, width)
	}
}

function GridLoadSettings_byColNames(grid, gridName, columns)
{
	for (var colName in columns)
	{
		var colIdx = columns[colName];

		var width = app.ReadINIString(INI_GRIDSETTINGS_PREFIX + gridName, INI_COLWIDTH_PREFIX + "_" + colName, "-1")
		if (width == -1)
			return   // se valore non trovato in ini esce subito, inutile proseguire a cercare anche le altre colonne

		// imposta la dimensione della colonna letta da file solo se la colonna non è già nascosta
		if (grid.ColWidth(colIdx) != 0)
			grid.ColWidth(colIdx) = width
	}
}

function GridSaveSettings_byColName(grid, gridName, columns, originalColumnsWidth)
{
	// effettua salvataggio solo se le colonne sono effettivamente state modificate
	if (!m_gridColumnsChanged)
		return
	
	for (var colName in columns)
	{
		var colIdx = columns[colName];

		// se la colonna era originariamente nascosta non ne salva la dimensione
		if (originalColumnsWidth && originalColumnsWidth[colIdx] == 0)
			continue

		var width = grid.ColWidth(colIdx)
		app.WriteINIString(INI_GRIDSETTINGS_PREFIX + gridName, INI_COLWIDTH_PREFIX + "_" + colName, width)
	}
}

function GridMoveUp(grid, gridDataPath, selectNodesFunc, gridDataPath_filterString)
{
	// passa i parametri alla funzione come TempVar
	// la GridMoveUp potrebbe infatti essere chiamata anche da un menu di popup sulla griglia
	SetGridTempVarsOpt( { grid:grid, datapath:gridDataPath, selectNodesFunc:selectNodesFunc, datapathFilterString:gridDataPath_filterString } )
	var ris = app.CallFunction("common.GridMoveUp")
	ClearGridTempVars()
	
	return ris
}

function GridMoveDown(grid, gridDataPath, selectNodesFunc, gridDataPath_filterString)
{
	// passa i parametri alla funzione come TempVar
	// la GridMoveDown potrebbe infatti essere chiamata anche da un menu di popup sulla griglia
	SetGridTempVarsOpt( { grid:grid, datapath:gridDataPath, selectNodesFunc:selectNodesFunc, datapathFilterString:gridDataPath_filterString } )
	var ris = app.CallFunction("common.GridMoveDown")
	ClearGridTempVars()
	
	return ris
}


function CloseDlg()
{
	// hack per evitare la warning di internet explorer alla chiusura
	window.opener = "x"
	window.open("", "_self")
	window.close()
}


//var m_currentElement

// funzione per debug pagine, che mostra posizione degli elementi e posizione del cursore del mouse
function EnableDebug()
{
	// tipi di tag per cui abilitare il tooltip
	var names = ["input", "label", "img", "button", "select" ]
	
	// calcola i tooltip con posizione e dimensione
	for (var n = 0; n < names.length; n++)
	{
		var list = document.getElementsByTagName(names[n])
		for (var i = 0; i < list.length; i++)
		{
			var elem = list[i]
			elem.title = elem.id + "\n" + elem.offsetLeft + "," + elem.offsetTop + "\n" + elem.offsetWidth + "x" + elem.offsetHeight
		}
	}
	
	// crea al volo il <div> che conterrà la posizione del mouse
	var mousePos = document.createElement('<div id="mousePos" style="position:absolute; top:0; left:0; color:white"></div>')
	document.body.appendChild(mousePos)

	// aggancia la funzione che mostra la posizione attuale del mouse
	document.onmousemove = function (e)
	{
		var absX = event.clientX + document.body.scrollLeft
		var absY = event.clientY + document.body.scrollTop
		var str = "Abs: " + absX + "," + absY
			
//		if (m_currentElement)
//			m_currentElement.style.border = ""
			
		var elem = document.elementFromPoint(absX, absY)
		if (elem)
		{
//			elem.style.border = "1px solid black"
//			m_currentElement = elem
			
			var x = 0
			var y = 0
			while (elem)
			{
				x += elem.offsetLeft
				y += elem.offsetTop
				elem = elem.offsetParent
			}
			
			var relX = absX - x
			var relY = absY - y
			str += "    Rel: " + relX + "," + relY
		}
		mousePos.innerText = str
	}
}

			
// setta nell'albero la pagina specificata come pagina associata all'elemento selezionato
// serve a salvare il tab corrente per poterlo ripristinare tornando successivamente sull'elemento attivo
function SaveActiveWindow(name)
{
	app.HMISetLinkedWindow("tree1", "", name)
}

// estrazione della versione firmware di un certo device tramite catalogo
function GetDeviceVersion(devicepath)
{
	// path del gft sorgente, in lowercase per il confronto case insensitive
	var gft = app.DataGet(devicepath + "/@template", 0).toLowerCase()
	// estrae tutti i nodi firmware e fa il confronto a mano per sopperire alla mancanza di un confronto tra stringhe case insensitive in xpath
	var nodelist = app.CallFunction("catalog.Query", "//deviceinfo[@deviceid = '" + GetLastPathElement(devicepath) + "']")
	var node
	while (node = nodelist.nextNode())
		if (node.getAttribute("template").toLowerCase() == gft)
		{
			// se esiste maxversion usa quella, altrimenti la version normale
			if (node.getAttribute("maxversion"))
				return node.getAttribute("maxversion")
			else
				return node.getAttribute("version")
		}
		
	return "?"
}

// funzione che periodicamente verifica una condizione di uscita e attende con setTimeout,
// necessario in HTML per implementare attese tenendo l'interfaccia grafica viva
function WaitCondition(maxItem, sleepMs, checkfunc, donefunc, timeoutfunc, progressfunc)
{
	var curIter = 0;
	
	// funzione interna stile 'closure' che riceve e modifica i parametri del chiamante, che si auto-reinnesca con setTimeout
	function periodicCheck()
	{
		if (checkfunc && checkfunc())
		{
			// condizione di arresto ciclo verificata
			if (donefunc)
				donefunc();
		}
		else if (curIter < maxItem)
		{
			// condizione non verificata, iterazione successiva dopo sleep
			if (progressfunc)
				progressfunc(curIter, maxItem);
				
			curIter++;
			setTimeout(periodicCheck, sleepMs);
		}
		else
		{
			// raggiunto numero max iterazioni, timeout
			if (timeoutfunc)
				timeoutfunc();
		}
	}
	
	periodicCheck();
}

function FixStyleForGrids()
{
	// con vecchi browser necessario mettere scrollbar perchè la griglia si dimensiona male
	if (document.documentMode < 10)
		document.getElementsByTagName("body")[0].style.overflow = "auto";
	else
		document.getElementsByTagName("body")[0].style.overflow = "hidden";
}

// utilizzare questa funzione per il reload completo della finestra corrente
// NON usare location.reload() perchè non scattano poi OnDocumentComplete ecc. dentro AlFramework in c++!
function ReloadCurrentWindow()
{
	app.RefreshWindow(_WINDOWNAME, gentypes.enuRefreshWinType.refFullReload);
}


/**
 * Scrive lo style_dark dark in tutte le pagine, se il dark theme e' abilitato.
 * Le regole dark SOVRASCRIVONO e non sostituiscono quelle "standard", quindi il CSS dark e' ridotto rispetto a quello di default 
 * perche' contiene solo gli stili che devono essere cambiati (ad es. il colore dello sfondo ma non la width dei button).
 */
var m_darkTheme = false;
try
{
	m_darkTheme = app.IsDarkTheme();
}
catch (err) {}

if(m_darkTheme)
{
	var csspath = "file://" + app.CatalogPath + "../Common/CSS/";
	document.write("<LINK href='" + csspath + "style_dark.css' rel='stylesheet' type='text/css'>");
}

function CSVToArray(strData, strDelimiter)
{
	// Check to see if the delimiter is defined. If not, then default to comma.
	strDelimiter = (strDelimiter || ",");

	// Create a regular expression to parse the CSV values.
	var objPattern = new RegExp(
		(
			// Delimiters.
			"(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
			// Quoted fields.
			"(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
			// Standard fields.
			"([^\"\\" + strDelimiter + "\\r\\n]*))"
		),
		"gi"
	);

	// Create an array to hold our data. Give the array a default empty first row.
	var arrData = [[]];
	// Create an array to hold our individual pattern matching groups.
	var arrMatches = null;

	// Keep looping over the regular expression matches until we can no longer find a match.
	while (arrMatches = objPattern.exec(strData))
	{
		// Get the delimiter that was found.
		var strMatchedDelimiter = arrMatches[1];

		// Check to see if the given delimiter has a length (is not the start of string) and if it matches
		// field delimiter. If id does not, then we know that this delimiter is a row delimiter.
		if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter)
			// Since we have reached a new row of data, add an empty row to our data array.
			arrData.push([]);

		var strMatchedValue;
		// Now that we have our delimiter out of the way, let's check to see which kind of value we captured (quoted or unquoted).
		if (arrMatches[2])
			// We found a quoted value. When we capture this value, unescape any double quotes.
			strMatchedValue = arrMatches[2].replace(new RegExp("\"\"", "g"), "\"");
		else
			// We found a non-quoted value.
			strMatchedValue = arrMatches[3];

		// Now that we have our value string, let's add it to the data array.
		arrData[arrData.length - 1].push(strMatchedValue);
	}

	// Return the parsed data.
	return arrData;
}

// gestione clipboard AxEditGrid
var CF_UNICODETEXT = 13
var DROPEFFECT = {	
	DROPEFFECT_NONE : 0,
	DROPEFFECT_COPY : 1,
	DROPEFFECT_MOVE : 2,
	DROPEFFECT_LINK : 4,
	DROPEFFECT_SCROLL : 0x80000000
}

var FTP_OP_STILL_ACTIVE = 259;
var FTP_MAX_RETRIES = 20;
var FTP_HIDE_WINDOW = 0;

function FTPGet(ftpServer, ftpUsername, ftpPassword, remotePath, remoteFile, localFile) {
	var ftpCommands = genfuncs.FormatMsg("\
open %1\n\
%2\n\
%3\n\
cd %4\n\
binary\n\
get %5 %6\n\
quit\
", ftpServer, ftpUsername, ftpPassword, remotePath, remoteFile, localFile);

	// Crea un file temporaneo con i comandi FTP
	var tempFile = genfuncs.FormatMsg("%1\\temp_ftp_commands.txt", shell.ExpandEnvironmentStrings("%TEMP%"));
	var file = app.CallFunction("common.SafeCreateTextFile", tempFile);
	if (!file)
		return;
	file.Write(ftpCommands);
	file.Close();

	var cmd = "ftp -s:" + tempFile;

	var handle = app.CallFunction("commonDLL.RunCommandAsync", cmd, FTP_HIDE_WINDOW);
	var result = app.CallFunction("commonDLL.GetProcessExitCode", handle);

	var cnt = 0;
	while (result == FTP_OP_STILL_ACTIVE && cnt <= FTP_MAX_RETRIES)
	{
		app.CallFunction("commonDLL.sleep", 200);
		result = app.CallFunction("commonDLL.GetProcessExitCode", handle);
		cnt++;
	}

	// timeout per essere sicuri che il file sia chiuso
	setTimeout(function() {
		try {
			m_fso.DeleteFile(tempFile);
		} catch (error) {}
	}, 20000)

	return result;
}

function FTPPut(ftpServer, ftpUsername, ftpPassword, remotePath, localFile, remoteFile) {
	// se specificato il percorso remoto lo usa. altrimenti il file remoto prendera' lo stesso nome di quello locale
	var fileToUpload = remoteFile ? localFile + " " + remoteFile : localFile;

	var ftpCommands = genfuncs.FormatMsg("\
open %1\n\
%2\n\
%3\n\
cd %4\n\
binary\n\
put %5\n\
quit\
", ftpServer, ftpUsername, ftpPassword, remotePath, fileToUpload);

	// Crea un file temporaneo con i comandi FTP
	var tempFile = genfuncs.FormatMsg("%1\\temp_ftp_commands.txt", shell.ExpandEnvironmentStrings("%TEMP%"));
	var file = app.CallFunction("common.SafeCreateTextFile", tempFile);
	if (!file)
		return;
	file.Write(ftpCommands);
	file.Close();

	var cmd = "ftp -s:" + tempFile;

	var handle = app.CallFunction("commonDLL.RunCommandAsync", cmd, FTP_HIDE_WINDOW);
	var result = app.CallFunction("commonDLL.GetProcessExitCode", handle);

	var cnt = 0;
	while (result == FTP_OP_STILL_ACTIVE && cnt <= FTP_MAX_RETRIES)
	{
		app.CallFunction("commonDLL.sleep", 200);
		result = app.CallFunction("commonDLL.GetProcessExitCode", handle);
		cnt++;
	}

	// timeout per essere sicuri che il file sia chiuso
	setTimeout(function() {
		try {
			m_fso.DeleteFile(tempFile);
		} catch (error) {}
	}, 20000)

	return result;
}