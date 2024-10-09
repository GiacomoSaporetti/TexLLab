var GRIDNAME = "ModbusCustomEditor"      // nome della griglia, usato in file INI

var gridDatapath = "/devicetemplate/deviceconfig/parameters"
var rowTemplate = "par"

//var columns = { address: 0, label: 1, type: 2, readOnly: 3, modbusType: 4, array: 5, autoInsert: 6, description: 7 }
//var m_columnsNodes = [ "protocol[@name='Modbus']/@commaddr", "@name", "@typetarg", "@readonly", "", "", "", "@descr" ]
var columns = { address: 0, label: 1, type: 2, readOnly: 3, modbusType: 4, description: 5 }
var m_columnsNodes = [ "protocol[@name='Modbus']/@commaddr", "@name", "@typetarg", "@readonly", "", "@descr" ]

// conversione da tipo di configuratore in valore numerico in enumeratore IEC
var m_parTypesToIEC = { "boolean": IECTypes.BOOL, 
						"char": IECTypes.SINT, "unsignedChar": IECTypes.USINT, 
						"short": IECTypes.INT, "unsignedShort": IECTypes.UINT, 
						"int": IECTypes.DINT, "unsignedInt": IECTypes.UDINT, 
						"float": IECTypes.REAL,
						"digitalInput": IECTypes.BOOL, "digitalOutput": IECTypes.BOOL }

var MODBUSTYPES = { DISCRETEINPUT: 0, COIL: 1, INPUTREG8: 2, HOLDINGREG8: 3, INPUTREG16: 4, HOLDINGREG16: 5, INPUTREG32: 6, HOLDINGREG32: 7, INPUTREG1: 8, HOLDINGREG1: 9 }

var m_addressRange = { start: 1, end: 65536}

var IECTypesToStr = {};
IECTypesToStr[IECTypes.BOOL] = "BOOL";
IECTypesToStr[IECTypes.SINT] = "SINT";
IECTypesToStr[IECTypes.USINT] = "USINT"
IECTypesToStr[IECTypes.BYTE] = "BYTE";
IECTypesToStr[IECTypes.INT] = "INT";
IECTypesToStr[IECTypes.UINT] = "UINT";
IECTypesToStr[IECTypes.WORD] = "WORD";
IECTypesToStr[IECTypes.DINT] = "DINT";
IECTypesToStr[IECTypes.UDINT] = "UDINT";
IECTypesToStr[IECTypes.DWORD] = "DWORD";
IECTypesToStr[IECTypes.REAL] = "REAL";

function InitGrid()
{
	// init enumeratori
	var typesEnum = [
		IECTypes.BOOL, "BOOL",
		IECTypes.SINT, "SINT",   IECTypes.USINT, "USINT", IECTypes.BYTE, "BYTE",
		IECTypes.INT,  "INT",    IECTypes.UINT,  "UINT",  IECTypes.WORD, "WORD",
		IECTypes.DINT, "DINT",   IECTypes.UDINT, "UDINT", IECTypes.DWORD, "DWORD",
		IECTypes.REAL, "REAL"
	]
	grid.AddEnum("typesEnum", typesEnum)
	grid.AddEnum("Boolean", [0, "False", 1, "True"]);
	grid.AddEnum("ModbusType", [
		MODBUSTYPES.DISCRETEINPUT, "Discrete Input", 
		MODBUSTYPES.COIL, "Coil",
		MODBUSTYPES.INPUTREG8, "Input Register (8 bit)",
		MODBUSTYPES.HOLDINGREG8, "Holding Register (8 bit)",
		MODBUSTYPES.INPUTREG16, "Input Register (16 bit)",
		MODBUSTYPES.HOLDINGREG16, "Holding Register (16 bit)",
		MODBUSTYPES.INPUTREG32, "Input Register (32 bit)",
		MODBUSTYPES.HOLDINGREG32, "Holding Register (32 bit)",
		MODBUSTYPES.INPUTREG1, "Input Register (1 bit)",
		MODBUSTYPES.HOLDINGREG1, "Holding Register (1 bit)"
	]);
	
	// init colonne
	grid.AddColumn( 80, 10, false,  true, egColumnType.egEdit,  0, "Address")
	grid.AddColumn(150, 99, false, false, egColumnType.egEdit,  0, "Label")
	grid.AddColumn( 80, 10, false, false, egColumnType.egCombo, 0, "Type", "typesEnum")
	grid.AddColumn( 80, 10, false, false, egColumnType.egCombo, 0, "Read only", "Boolean")
	grid.AddColumn(170, 10, false, false, egColumnType.egCombo, 0, "Modbus type", "ModbusType")
//	grid.AddColumn( 80, 10,  true,  true, egColumnType.egEdit,  0, "Array[]")
//	grid.AddColumn( 80, 10, false, false, egColumnType.egCombo, 0, "Auto insert", "Boolean")
	grid.AddColumn(300, 99, false, false, egColumnType.egEdit,  0, "Description")
	
	grid.Init()
	grid.UseSlowEvents = false
	
//	GridLoadSettings(grid, GRIDNAME)
		
	// gestione evidenziamento errore
//	SearchErrorTable(grid, gridDatapath, m_columnsNodes)
	
//	RestoreGridSort(grid, gridDatapath)
}

/*function OnUnload()
{
	GridSaveSettings(grid, GRIDNAME)
}*/

function GetFreeIpa()
{
	// lettura contatore ipa successivo
	var nextIpa = parseInt(GetNode(m_xmldoc, gridDatapath + "/@nextIpa"))
	SetNode(m_xmldoc, gridDatapath + "/@nextIpa", nextIpa + 1)
	return nextIpa
}

function FindFreeAddress()
{
	var used = {}
	var nodelist = m_xmldoc.selectNodes(gridDatapath + "/par")
	var node
	while (node = nodelist.nextNode())
	{
		var size = GetParamSize(node)
		if (size == 0)
			size = 1
		
		var protNode = node.selectSingleNode("protocol[@name='Modbus']")
		var address = parseInt(protNode.getAttribute("commaddr"))
		
		for (var i = 0; i < size; i++)
			used[address + i] = true
	}
	
	for (var i = m_addressRange.start; i <= m_addressRange.end; i++)
		if (!used[i])
			return i
			
	return -1
}


function AddRow()
{
	var newNode = AddTemplateData("par", gridDatapath, true)
	
	var address = FindFreeAddress()
	newNode.selectSingleNode("protocol[@name='Modbus']/@commaddr").text = address
	
	grid.InsertRows(1)
	grid.Move(grid.NumRows - 1, 0)
	
	SetModifiedFlag()
}

function DeleteRow()
{
	if (grid.NumRows == 0) return
	
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
				var node = m_xmldoc.selectSingleNode(gridDatapath + "/*[" + row + "]")
				var ipaToDelete = node.getAttribute("ipa");
				node.parentNode.removeChild(node)

				// cerco nodi in modbusMapping (input e output) e sendParams che usano il parametro che sto cancellando
				var delQry = gridInputDatapath + "/" + rowTemplateInputOutput + genfuncs.FormatMsg("[ioObject/@objectIndex=%1]", ipaToDelete) +
							" | " + gridOutputDatapath + "/" + rowTemplateInputOutput + genfuncs.FormatMsg("[ioObject/@objectIndex=%1]", ipaToDelete) +
							" | " + gridParametrizationDatapath + "/" + rowTemplateParametrization + genfuncs.FormatMsg("[address=%1]", ipaToDelete);
				var delNodes = m_xmldoc.selectNodes(delQry);
				var delNode;
				while (delNode = delNodes.nextNode())
					delNode.parentNode.removeChild(delNode);
			}

			grid.DeleteRows(list.length);

			// ricarica anche le altre griglie
			ReloadParamAndInOutGridData();

			SetModifiedFlag();

			return;
		}
	}

	// multiselezione OFF, linea singola
	var row = grid.SelectedRow + 1
	var node = m_xmldoc.selectSingleNode(gridDatapath + "/*[" + row + "]")
	node.parentNode.removeChild(node)
	grid.DeleteRows(1)
	SetModifiedFlag()
}

function ReloadGridData()
{
	if (grid.NumRows != 0)
		grid.DeleteRows(grid.NumRows)
		
	grid.InsertRows(GetNumRows())

	ReloadParamAndInOutGridData();
}

function ReloadParamAndInOutGridData() {
	if (gridParametrization.NumRows > 0)
		gridParametrization.DeleteRows(gridParametrization.NumRows)
	gridParametrization.InsertRows(GridParametrizationGetRecordNum());

	if (gridInput.NumRows > 0)
		gridInput.DeleteRows(gridInput.NumRows);
	gridInput.InsertRows(GridInputOutputGetRecordNum(gridInputDatapath));

	if (gridOutput.NumRows > 0)
		gridOutput.DeleteRows(gridOutput.NumRows);
	gridOutput.InsertRows(GridInputOutputGetRecordNum(gridOutputDatapath));
}

function SelectNodes(xpath)
{
	return m_xmldoc.selectNodes(xpath);
}

function AddTemplateData(rowTemplate, dataPath, append)
{
	if (!append)
		return  // insertbefore non implementato
	
	// tutti i nodi ottenuti con GetTemplateData hanno template e version che puntano al PCT, deve toglierli
	var newnode = app.GetTemplateData(rowTemplate)[0].cloneNode(true)
	newnode.removeAttribute("template")
	newnode.removeAttribute("version")
	
	// in caso di append il dataPath è quello principale della griglia (non della riga)
	var parent = m_xmldoc.selectSingleNode(dataPath)
	parent.appendChild(newnode)
	
	newnode.setAttribute("ipa", GetFreeIpa())
	
	return newnode
}

function OnCutDeleteRow(dataPath)
{
	var rowNode = m_xmldoc.selectSingleNode(dataPath)
	var parent = rowNode.parentNode
	parent.removeChild(rowNode)
}

// funzione callback speciale che restituisce il nuovo valore per le celle durante l'operazione di paste
function PasteGetNewValue(row, col, oldValue)
{
	if (col == columns.address)
		return FindFreeAddress()
	else
		return oldValue
}


function GetParamSize(node)
{
	var typetarg = node.getAttribute("typetarg")
	if (!typetarg)
		return 0
	
	typetarg = m_parTypesToIEC[typetarg]
		
	var size = GetModbusObjectSizeFromIEC( typetarg, 1 )
	return size
}

// restituisce il numero di registri modbus necessari per contenere il tipo IEC indicato, preso da parameters.js
function GetModbusObjectSizeFromIEC(type, strsize)
{
	switch (type)
	{
	case IECTypes.BOOL:
	case IECTypes.SINT:
	case IECTypes.USINT:
	case IECTypes.INT:
	case IECTypes.UINT:
	case IECTypes.BYTE:
	case IECTypes.WORD:
		return 1
	
	case IECTypes.DINT:
	case IECTypes.UDINT:
	case IECTypes.DWORD:
	case IECTypes.REAL:
	case IECTypes.TIME:
		return 2
	
	case "LINT":
	case "ULINT":
	case "LREAL":
		return 4
	
	case "STRING":
		return Math.ceil(strsize / 2) // i caratteri occupano mezza word modbus l'uno
	}
}

// fa la stessa logica della GetElemI ma ritorna le stringhe che descrivono il tipo
function GetParTypeString(value, format) {
	if (format === undefined)
		format = "";

	// verifica se hex controllato il formato se %x
	var hex = format.toLowerCase() == "%x";

	// conversione da tipo configuratore a valore numerico nell'enum IEC
	var IECNumber = m_parTypesToIEC[value];

	// se hex sostituisce col tipo IEC corretto
	if (hex && IECNumber == IECTypes.USINT)
		return IECTypesToStr[IECTypes.BYTE];
	else if (hex && IECNumber == IECTypes.UINT)
		return IECTypesToStr[IECTypes.WORD];
	else if (hex && IECNumber == IECTypes.UDINT)
		return IECTypesToStr[IECTypes.DWORD];
	else
		return IECTypesToStr[IECNumber];
}