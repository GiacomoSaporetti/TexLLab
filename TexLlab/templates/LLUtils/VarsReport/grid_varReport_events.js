
function grid::ClickElem(row,col)
{
	grid.EditMode(false)
}

function grid::DblClickElem(row,col)
{
	if (col == columns.name)
	{
		var rowData = m_gridRows[row];
		var value = rowData.SID;

		if(value)
			app.CallFunction("logiclab.GoToPLCLink", value);
	}
}

function grid::GetTextColor(row,col)
{
	
}

function grid::GetElemS(row,col)
{
	var colName = m_columnsNodes[col];
	var rowData = m_gridRows[row][colName];

	if(col == columns.initValue)
	{
		var type = rowData.type;
		var value = rowData.value;
		if(type == "BOOL" || m_typeTargs[type] == undefined)
		{
			if(m_enums[type] != undefined)
			{
				grid.EventResult = m_enums[type][value];
				return;
			}
		}
	}
	
	grid.EventResult = rowData;
}

function grid::GetElemI(row,col)
{
	// tutti di tipo testo
	grid.EventResult = ""
}

function grid::SetElemS(row,col,s)
{
	
}

function grid::SetElemI(row,col,i)
{
	
}

function grid::ColClick(col)
{
	// ordinamento custom
	if (col == columns.dataBlock)
		GridSort(grid, m_gridDatapath, col, GridSortSpecialFunc.byDatablockNum);
	else
		GridSort(grid, m_gridDatapath, col);
}

function grid::GetColType(row, col)
{
	grid.EventResult = egColumnType.egEdit
}

function grid::AllowEdit(row,col)
{
	grid.EventResult = false;
}


function grid::SpecialEvent(id, param)
{
	
}

function grid::EndColTrack(col)
{
	m_gridColumnsChanged = true
}