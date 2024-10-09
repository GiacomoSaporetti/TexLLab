
function grid::ClickElem(row,col)
{
	grid.EditMode(true)
}

function BuildPath(row,col)
{
	return gridDatapath + "/*[" + (row+1) + "]/" + m_columnsNodes[col]
}

function grid::GetElemS(row,col)
{
    if (col <= LAST_COLUMN_XMLDATA)
    {
	    var s = window.external.DataGet(BuildPath(row,col), 0)
        grid.EventResult = s
    }
    else
    {
        //  cerca informazioni in base a indice e sottoindice parametro
        var index = parseInt(grid.Elem(row, columns.index))
        var subindex = parseInt(grid.Elem(row, columns.subindex))
		var key = "0x" + index.toString(16) + "." + subindex.toString()
		if ( !m_paramDBMap )
			var par = undefined
		else
			var par = m_paramDBMap[key]

        if (par)
        {
            if (col == columns.objtype)
                grid.EventResult = par.type
            else if (col == columns.size)
			{
                var size = app.CallFunction("common.GetIECTypeBits", par.type)
				if ( size < m_copsCfg.granularity )
					size = m_copsCfg.granularity	//	BOOL viene trattato come BYTE
				grid.EventResult = size 
			}
            else if (col == columns.name)
                grid.EventResult = par.name
            else if (col == columns.description)
                grid.EventResult = par.description
            else if (col == columns.readonly)
                grid.EventResult = parseInt(par.readonly) ? "true" : "false"
            else
                grid.EventResult = "?"
        }
        else
        {
            if (col == columns.size)
                grid.EventResult = "0"
            else
                grid.EventResult = "?"
        }
    }
}

function grid::GetElemI(row,col)
{
    if (col <= LAST_COLUMN_XMLDATA)
    {
        grid.EventResult = window.external.DataGet(BuildPath(row, col), 0)
    }
}

function grid::SetElemS(row,col,s)
{
    var oldvalue = grid.Elem(row, col)

    if (oldvalue == s) return

    if (col <= LAST_COLUMN_XMLDATA)
    {
        window.external.DataSet(BuildPath(row,col), 0, s)
    }
}

function grid::SetElemI(row,col,i)
{
    if (col <= LAST_COLUMN_XMLDATA)
    {
        window.external.DataSet(BuildPath(row,col), 0, i)
    }
}

function grid::GetRecordNum()
{
	var list = window.external.SelectNodesXML(gridDatapath + "/*")
	if (list) grid.EventResult = list.length
}

function grid::PopupMenu(row, col, x, y)
{
	ShowGridPopup(grid, row, col, x, y, gridDatapath)
}

function grid::ColClick(col)
{
	GridSort(grid, gridDatapath, col)
}

function grid::SpecialEvent(id, param)
{
	GridSpecialEvent(id, param, grid, gridDatapath, undefined)
}

function grid::EndColTrack(col)
{
	m_gridColumnsChanged = true
}

function GetParamSize(node)
{
	var typetarg = GetNode(node, "typetarg")
	if (!typetarg)
		return 0   // per parametri non assegnati

	var size = app.CallFunction("common.GetIECTypeBits", typetarg)
	if ( size < m_copsCfg.granularity )
		size = m_copsCfg.granularity	//	BOOL viene trattato come BYTE
	
	return size
}
