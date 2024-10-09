function EditVariables(row)
{
	app.TempVar("Payload_type") = grid.Elem(row, columns.payload);
	app.OpenWindow("MQTTVarAssign", app.Translate("Choose PLC variable"), gridDatapath + "/brokerMapping[" + (row + 1) + "]/");
	// forzo aggiornamento della colonna col nome della variabile
	grid.Update(row, columns.name);
}

function grid::ClickElem(row, col)
{
	if (col == columns.variable)
		EditVariables(row)
	else
		grid.EditMode(true)
}

function grid::GetTextColor(row, col)
{
	if (row == gridErrorPos.row && col == gridErrorPos.col)
		grid.EventResult = 0x0000FF
}

function BuildPath(row, col)
{
	return gridDatapath + "/*[" + (row + 1) + "]/" + m_columnsNodes[col]
}

function grid::GetElemS(row, col)
{
	if (col == columns.variable)
	{
		// ottengo la lista di variabili mappate per il topic corrente
		let varList = [];
		var mappingNodes = app.SelectNodesXML(gridDatapath + "/brokerMapping[" + (row + 1) + "]/brokerField");
		var mappingNode;
		while (mappingNode = mappingNodes.nextNode())
		{
			var varName = mappingNode.getAttribute("value");
			if (varName)
				varList.push(varName);
		}

		grid.EventResult = varList.join(", ");
	}
	else
		grid.EventResult = window.external.DataGet(BuildPath(row, col), 0)
}

function grid::GetElemI(row, col)
{
	grid.EventResult = window.external.DataGet(BuildPath(row, col), 0)
}

function grid::SetElemS(row, col, s)
{
	if ((col == columns.inhibittime || col == columns.polling) && s < 0)
	{

		grid.EventResult = false
		return
	}

	window.external.DataSet(BuildPath(row, col), 0, s)
}

function grid::SetElemI(row, col, i)
{
	window.external.DataSet(BuildPath(row, col), 0, i)
}

function grid::GetRecordNum()
{
	var list = window.external.SelectNodesXML(gridDatapath + "/*")
	if (list) grid.EventResult = list.length
}

function grid::PopupMenu(row, col, x, y)
{
	//	if (rowTemplate)
	//		ShowGridPopup(grid, row, col, x, y, gridDatapath, rowTemplate, "menu_gridPopup")
}

function grid::ColClick(col)
{
	GridSort(grid, gridDatapath, col)
}

function grid::SpecialEvent(id, param)
{
	//	if (rowTemplate)
	//		GridSpecialEvent(id, param, grid, gridDatapath, rowTemplate)
}

function grid::EndColTrack(col)
{
	m_gridColumnsChanged = true
}

function grid::OptionClick(row, col)
{
	if (col == columns.variable)
		EditVariables(row);
}

function grid::AllowEdit(row, col)
{
	grid.EventResult = true
}