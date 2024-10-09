var tablePath = "."		// path relativo della tabella
var rowTemplate
var m_extName
var m_parentDevice

var gridDatapath = ""

var columns = { value: 0, name: 1, description: 2 }
var m_columnsNodes = []

var columnsName = ["Value", "Name", "Description"]
var gridErrorPos = { row: -1, col: -1 }

function InitGrid(datapath)
{	
	var i
	for (i in columns)
		m_columnsNodes.push(i)
	
	//	get parent device node
	m_parentDevice = app.SelectNodesXML(datapath + ".")[0].selectSingleNode(XPATH_ROOTDEVICE)
	//	get extension name
	m_extName = m_parentDevice.getAttribute("ExtensionName")
	//	template data
	rowTemplate = "AlDatabase/enum/enum_value"
	
	grid.AddColumn( 80, 100, false,  true, egColumnType.egEdit, 0, app.Translate("Value") )
	grid.AddColumn(200, 100, false, false, egColumnType.egEdit, 0, app.Translate("Name") )
	grid.AddColumn(200, 100, false, false, egColumnType.egEdit, 0, app.Translate("Description") )
	
	gridDatapath = datapath + tablePath
	
	grid.Init()
	
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
	
	//RestoreGridSort(grid, gridDatapath)
}

//	return the default value for the new row (max + 1)
function GetDefaultValue()
{
    var nodeList = app.SelectNodesXML(gridDatapath + "/enum_value")
    if ( nodeList.length == 0 )
	{
        return 0
	}
    else
    {
		var maxValue = 0
		
		var node
		while ( node = nodeList.nextNode() )
		{
			var value = parseInt( genfuncs.GetNode( node, "value" ) )
			if ( value > maxValue )
				maxValue = value
		}
		
		return maxValue + 1
    }
}

function grid_AddRowXML()
{
	//	get default value (before inserting new row)
	var defaultValue = GetDefaultValue()
	
	var datapath = window.external.AddTemplateData(rowTemplate, gridDatapath, 0, false)
	var node = app.SelectNodesXML( datapath )[0]	
	
	genfuncs.SetNode( node, "value", defaultValue )
	
	grid.InsertRows(1)
	
	grid.focus()
	grid.EditMode(true)
	grid.Move(grid.GetRealRow(grid.NumRows-1), columns.value)
}

function grid_DeleteRowXML()
{
	if (grid.NumRows == 0) return
	
	var row = grid.SelectedRow + 1
	if( row > 0 )
	{ 
		window.external.DataDelete(gridDatapath + "/enum_value[" + row + "]", 0)
		grid.DeleteRows(1)
		grid.focus();
	}
}

