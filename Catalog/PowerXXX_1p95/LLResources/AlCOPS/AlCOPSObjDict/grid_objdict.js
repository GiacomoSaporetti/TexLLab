var GRIDNAME = "ObjectDictionary"		// nome della griglia, usato in file INI
var tablePath = "."						// path relativo della tabella
var rowTemplate = "objdict"				// nome del template della riga
var gridDatapath = ""

var columns = { ipa: 0, description: 1, index: 2, subindex: 3, pdomapping: 4, readonly: 5, ipa_num : 6 }
var m_columnsNodes = [ "ipa", "description", "index", "subindex", "pdomapping", "readonly", "ipa" ]

var gridErrorPos = { row: -1, col: -1 }

var m_parentDevice
var m_publicObjectsDefined = 0

function InitGrid(datapath)
{
	// risale al nodo config padre
	m_parentDevice = app.SelectNodesXML(datapath + "./..")[0]
	
	CreateEnums()
			
	grid.AddColumn(200, 100, false, false, egColumnType.egCombo, 0, "Object", "paramsEnum")
	grid.AddColumn(200, 100, true, false, egColumnType.egEdit, 0, "Description")
	grid.AddColumn(100, 100, false, false, egColumnType.egEdit, 0, "Index (hex)")
	grid.AddColumn(100, 100, false, false, egColumnType.egEdit, 0, "SubIndex (hex)")
	grid.AddColumn(100, 100, false, true, egColumnType.egCombo, 0, "PDO mapping", "BOOL")
	grid.AddColumn(100, 100, false, true, egColumnType.egCombo, 0, "Readonly", "BOOL")
	grid.AddColumn(100, 100, true,  true, egColumnType.egEdit, 0, "IPA")
	
	gridDatapath = datapath + tablePath
	grid.Init()
	
	GridLoadSettings(grid, GRIDNAME)
	
	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
}

function OnUnload()
{
	GridSaveSettings(grid, GRIDNAME)
}

function CheckCANOpenIndexRange(index)
{
	if  ( isNaN( index ) )
	{
		return false
	}
	else if	( ! ( ( index >= m_CANOpen_IndexRange.start && index <= m_CANOpen_IndexRange.end ) || index == INDEX_CANOPEN_NONE ) )
	{
		var msg = app.Translate("Invalid CANOpen index value! Must be in %1h..%2h range or equal to %3 for no CANOpen parameter.").replace("%1", m_CANOpen_IndexRange.start.toString(16)).replace("%2", m_CANOpen_IndexRange.end.toString(16)).replace("%3", INDEX_CANOPEN_NONE)
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
		return false
	}
	else
		return true
}

function CheckCANOpenSubindexRange(subindex)
{
	if  ( isNaN( subindex ) )
	{
		return false
	}
	else if	( ! ( subindex >= m_CANOpen_SubindexRange.start && subindex <= m_CANOpen_SubindexRange.end ) )
	{
		var msg = app.Translate("Invalid CANOpen subindex value! Must be in %1h..%2h range.").replace("%1", m_CANOpen_SubindexRange.start.toString(16)).replace("%2", m_CANOpen_SubindexRange.end.toString(16))
		app.MessageBox(msg, "", gentypes.MSGBOX.MB_ICONEXCLAMATION)
		return false
	}
	else
		return true
}

// cerca un nuovo indice
function FindFreeIndexCAN()
{
	var used = {}

		// risale a CANopenObjDictNode
	var CANopenObjDictNode = app.SelectNodesXML(gridDatapath)[0]

		//cerco su variabili e parametri
	var nodelist = CANopenObjDictNode.selectNodes( ".//objdict" )
	var node
	while (node = nodelist.nextNode())
	{
		var index = parseInt(GetNode(node, "index"))
		used[index] = true
	}
	
	for (var i = m_CANOpen_IndexRange.definit; i <= m_CANOpen_IndexRange.end; i++)
		if (!used[i])
			return i
			
	for (var i = m_CANOpen_IndexRange.start; i <= m_CANOpen_IndexRange.definit; i++)
		if (!used[i])
			return i			
			
	return -1
}

function grid_AddRowXML()
{
	if ( !m_publicObjectsDefined )
	{
		app.MessageBox( "Please define 'Parameters' and 'Status variables' first", "Object Dictionary", gentypes.MSGBOX.MB_ICONEXCLAMATION )
		return
	}

	var index = FindFreeIndexCAN()
	var datapath = app.AddTemplateData(rowTemplate, gridDatapath, 0, false)
	if ( index != -1 ) app.DataSet(datapath + "/index", 0, index)
	grid.InsertRows(1)
	
	grid.focus()
	grid.EditMode(true)
	grid.Move(grid.GetRealRow(grid.NumRows-1), columns.ipa)
}

function grid_DeleteRowXML()
{
	grid_DeleteMultiple(grid, gridDatapath)
}

function CreateEnums( )
{
    var paramsEnum = []
	var paramsOrdered = []
	
	m_publicObjectsDefined = 0
	
	// estrae l'elenco di tutti i parametri
	var params = m_parentDevice.selectNodes("./params/param | ./paramsRO/param")
	var par
	while (par = params.nextNode())
	{
		//ricerca dell'assegnamento nei menù
		var ipa = parseInt(GetNodeText(par, "ipa") )
		var name = GetNodeText(par, "name")
		paramsOrdered.push( { ipa:ipa, name:name } )
		
		m_publicObjectsDefined += 1
	}
	
	if ( m_publicObjectsDefined == 0 )
	{
		paramsEnum.push( -1, "-" )
	}
	else
	{
			//applichiamo l'ordinamento alfabetico
		paramsOrdered.sort( paramsOrderingFn )

		for( var i=0; i < paramsOrdered.length; i++ ) 
			paramsEnum.push( paramsOrdered[i].ipa, paramsOrdered[i].name )
	}
	
	grid.AddEnum("paramsEnum", paramsEnum )
	
	// enum per booleani
	grid.AddEnum( "BOOL", [0, "False", 1, "True"])
}

function paramsOrderingFn( par1, par2 )
{
	if( par1.name < par2.name )
		return -1
	else if( par1.name == par2.name )
		return 0
	else
		return 1
}

// -------------------------------------- gestione import/export di parametri e status vars da file CSV ------------------------------------

function ExportToCSVFile()
{
	var selections = app.CallFunction("common.GridGetSelections", grid)
	if (selections.length == 0)
	{
		app.MessageBox(app.Translate("Please select at least one or more rows to export"), "", gentypes.MSGBOX.MB_ICONERROR);
		return;
	}

	var dataPath = app.GetCurrentWindowData();
	var msg = app.Translate("Object Dictionary");

	var filename = app.CallFunction("extfunct.ShowSaveFileDlgEx", "Comma separated values file|*.CSV|", "CSV", msg);
	if (!filename)
		return false;

	var fso = app.CallFunction("common.CreateObject", "Scripting.FileSystemObject");
	try
	{
		var file = fso.CreateTextFile(filename, true);
		if (!file)
		{
			app.MessageBox(genfuncs.FormatMsg(app.Translate("Error creating new file %1"), filename), "", gentypes.MSGBOX.MB_ICONERROR);
			return false;
		}
	}
	catch (err)
	{
		app.MessageBox(app.Translate("Error exporting to file."), "", gentypes.MSGBOX.MB_ICONERROR);
		return false;
	}

	var headerRow = [];
	// riempimento riga di intestazione con nome colonne
	var parTemplate = app.GetTemplateData(rowTemplate)[0];
	var nodelist = parTemplate.selectNodes("*");

	var nodesMap = {} // lista dei tag xml effettivamente sa salvare

	for (var i in m_columnsNodes)
	{
		var colName = m_columnsNodes[i];
		if (colName == "description")
			continue;

		if (colName == "ipa")
			colName = "object"

		if (nodesMap[colName])
			continue

		headerRow.push(colName);
		nodesMap[colName] = true;
	}

	file.writeLine("#" + headerRow.join(','));

	var counter = 0;
	for (var i = 0; i < selections.length; i++)
	{
		var row = parseInt(selections[i]);
		var node = app.SelectNodesXML(gridDatapath + "/" + rowTemplate)[row];
		if (!node)
			continue;

		var fileRow = [];
		for (var nodeName in nodesMap)
		{
			if (nodeName == "object")
				nodeName = "ipa"

			var value = '"' + GetNode(node, nodeName) + '"';
			if (value.indexOf(",") != -1)
				value = '"' + value + '"';

			fileRow.push(value);
		}

		file.writeLine(fileRow.join(','));

		counter++;
	}

	file.Close();

	var logmsg = genfuncs.FormatMsg("%1: %2 records exported", msg, counter);
	app.MessageBox(logmsg, "", gentypes.MSGBOX.MB_ICONINFORMATION);
	app.PrintMessage(logmsg + " to file " + filename);
}

function ImportFromCSVFile()
{
	var FUNNAME = app.Translate("Object Dictionary import") + ": "

	var filename = app.CallFunction("extfunct.ShowOpenFileDlgEx", "Comma separated values file|*.CSV|", "CSV");
	if (!filename)
		return false

	var fso = app.CallFunction("common.CreateObject", "Scripting.FileSystemObject")
	try
	{
		var inputFile = fso.OpenTextFile(filename, gentypes.enuOpenTextFileModes.ForReading);
	}
	catch (err)
	{
		app.MessageBox(FUNNAME + app.Translate("Error importing from file."), "", gentypes.MSGBOX.MB_ICONERROR);
		return

	}

	var fileRows = []
	while (!inputFile.AtEndOfStream)
		fileRows.push(inputFile.ReadLine())

	if (fileRows.length == 0)
	{
		app.MessageBox(FUNNAME + app.Translate("error importing from file.\nMissing header?"), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}

	// prima riga di intestazione, definisce i tag xml per le DataSet
	var fileHeader = fileRows.shift();
	var nodeNames = fileHeader.split(",");
	if (nodeNames.length == 0)
	{
		app.MessageBox(app.Translate("error importing from file.\nMissing header?"), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}

	// rimozione #
	if (nodeNames[0].indexOf("#") != 0)
	{
		app.MessageBox(FUNNAME + app.Translate("error importing from file.\nMissing header?"), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}

	nodeNames[0] = nodeNames[0].replace("#", "");

	var importingStatus = false;
	for (var i = 0; i < nodeNames.length; i++)
	{
		if (nodeNames[i] == "object")
			nodeNames[i] = "ipa";
	}
	
	var objDicTemplate = app.GetTemplateData(rowTemplate)[0]
	// controllo coerenza templatedata
	for (var i = 0; i < nodeNames.length; i++)
	{
		var objDicTemplateChild = objDicTemplate.selectNodes(nodeNames[i])[0];
		if (!objDicTemplateChild)
		{
			app.MessageBox(FUNNAME + app.Translate("error importing from file.\nWrong header?"), "", gentypes.MSGBOX.MB_ICONERROR);
			return
		}
	}

	var devConfig = app.SelectNodesXML(gridDatapath + "/..")[0]
	var counter = 0;
	var mergedCounter = 0;
	var CSVMatrix = CSVToArray(fileRows.join("\n"))
	var skippedCounter = 0;

	for (var i = 0; i < CSVMatrix.length; i++)
	{
		var records = CSVMatrix[i]
		if (records.length == 0)
			continue;

		var nodesMap = {}
		for (var z = 0; z < records.length; z++)
			nodesMap[nodeNames[z]] = records[z]

		var ipa = nodesMap["ipa"];
		
		// controllo esistenza parametro
		var nodelist = app.SelectNodesXML(gridDatapath.slice(0,-1) + "..//param[ipa='"+ ipa +"']")
		if (nodelist.length == 0)
		{
			app.PrintMessage(FUNNAME + app.Translate("object '%1' does not exists, skipped").replace("%1", ipa));
			skippedCounter++;
			continue
		}		
		
		// controllo duplicazione indirizzi con emissione di log
		var datapath = null
		var nodelist = app.SelectNodesXML(gridDatapath.slice(0, -1) + "..//" + rowTemplate + "[ipa='" + ipa + "']")
		if (nodelist && nodelist.length > 0)
		{
			// se stesso ipa è un merge
			datapath = app.GetDataPathFromNode(nodelist[0]);
			app.PrintMessage(FUNNAME + app.Translate("object '%1' exists, merged").replace("%1", ipa));
			mergedCounter++;
		}

		// se datapath si tratta di un nuovo record da aggiungere
		if (datapath == null)
		{
			datapath = app.AddTemplateData(rowTemplate, gridDatapath, 0, false);
			counter++
		}

		// aggiunta dati solo se coerenti con templatedata
		for (var nodeName in nodesMap)
		{
			var value = nodesMap[nodeName];
			if (isHex(value))
				value = parseInt(value, 16)

			app.DataSet(datapath + "/" + nodeName, 0, value)
		}
	}

	if (counter == 0 && mergedCounter == 0)
	{
		app.MessageBox(FUNNAME + app.Translate("no objects imported.\nSee logs on output window for more information"), "", gentypes.MSGBOX.MB_ICONERROR);
		return
	}

	app.MessageBox(FUNNAME + app.Translate("operation completed.\nSee logs on output window for more information"), "", gentypes.MSGBOX.MB_ICONINFORMATION);

	var logsMsgs = []
	if (counter > 0)
	{
		grid.InsertRows(counter);
		grid.focus();

		logsMsgs.push(counter + " " + app.Translate("imported"));
	}

	if (mergedCounter > 0)
	{
		grid.Update(-1, -1);

		logsMsgs.push(mergedCounter + " " + app.Translate("merged"));
	}
	
	if (skippedCounter	> 0)
	{
		logsMsgs.push(skippedCounter + " " + app.Translate("skipped"));
	}

	var logMsg = FUNNAME + app.Translate("result:");
	app.PrintMessage(logMsg + " " + logsMsgs.join(","));
	app.CallFunction("extfunct.SelectOutputTab", 3)
}

function isHex(num)
{
	return (num + "").match(/^0x[0-9a-f]+$/i)
}