var tablePath = "menuItems"		// path relativo della tabella
var rowTemplate = "menuItem"						// nome del template della riga
var gridDatapath = ""
var m_menuNode 

var columns = { ipa: 0, description: 1 }
var m_columnsNodes = []

var gridErrorPos = { row: -1, col: -1 }

var m_parentDevice
var m_parCount = 0

function InitGrid(datapath)
{
	for (var i in columns)
		m_columnsNodes.push(i)
	
	// risale al device padre
	m_menuNode = app.SelectNodesXML(datapath + ".")[0]
	m_parentDevice = m_menuNode.selectSingleNode(XPATH_PARENTDEVICE)
	
	CreateEnums()
			
	grid.AddColumn(200, 100, false, false, egColumnType.egCombo, 0, "Name", "paramsEnum")
	grid.AddColumn(400, 100, true,  false, egColumnType.egEdit, 0, "Description")
	
	gridDatapath = datapath + tablePath
	grid.Init()
	
	RestoreGridSort(grid, gridDatapath)
	// gestione evidenziamento errore
	gridErrorPos = SearchErrorTable(grid, gridDatapath, m_columnsNodes)
}

function grid_AddRowXML()
{
	if ( m_parCount == 0 )
	{
		var caption = app.Translate( "Menus definition" )
		app.MessageBox(app.Translate("No parameters available.\nDefine Parameters/Status variables before menu definition."), caption, gentypes.MSGBOX.MB_ICONEXCLAMATION)
		return
	}
	
	app.AddTemplateData(rowTemplate, gridDatapath, 0, false)
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
	// estrae l'elenco di tutti i parametri
	var params = m_parentDevice.selectNodes("config/params/param | config/paramsRO/param")
	var par
	while (par = params.nextNode())
	{
		//ricerca dell'assegnamento nei menù
		var ipa = parseInt(GetNodeText(par, "ipa") )
		var name = GetNodeText(par, "name")
		paramsOrdered.push( { ipa:ipa, name:name } )
		
		m_parCount++
	}
	
		//applichiamo l'ordinamento alfabetico
	paramsOrdered.sort( paramsOrderingFn )

	for( var i=0; i < paramsOrdered.length; i++ ) 
		paramsEnum.push( paramsOrdered[i].ipa, paramsOrdered[i].name )
	
	grid.AddEnum("paramsEnum", paramsEnum )
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
