var tablePath = "GenericRTU_config/sendParams"		// path relativo della tabella
var rowTemplate = "sendParam"						// nome del template della riga



var gridDatapath = ""

var columns = { address: 0, type: 1, value: 2, timeout: 3 }
var m_columnsNodes = []

var gridErrorPos = { row: -1, col: -1 }


function InitGrid(datapath)
{	
	for (var i in columns)
		m_columnsNodes.push(i)
	
	grid.AddEnum("paramType", [0, "BOOL", 1, "SINT", 2, "USINT", 3, "INT", 4, "UINT", 5, "DINT", 6, "UDINT", 7, "REAL"])
	
	grid.AddColumn( 80, 100, false, false, egColumnType.egEdit,      0, window.external.Translate("Address"))  //translate
	grid.AddColumn( 80, 100, false, false, egColumnType.egComboText, 0, window.external.Translate("Type"), "paramType")  //translate
	grid.AddColumn( 80, 100, false,  true, egColumnType.egEdit,      0, window.external.Translate("Value"))  //translate
	grid.AddColumn( 80, 100, false,  true, egColumnType.egEdit,      0, window.external.Translate("TimeOut"))  //translate
	
	gridDatapath = datapath + tablePath
	grid.Init()
	
	
	RestoreGridSort(grid, gridDatapath)
	
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
}

function grid_AddRowXML()
{
	window.external.AddTemplateData(rowTemplate, gridDatapath, 0, false)
	grid.InsertRows(1)
}

function grid_DeleteRowXML()
{
	grid_DeleteMultiple(grid, gridDatapath)
}

