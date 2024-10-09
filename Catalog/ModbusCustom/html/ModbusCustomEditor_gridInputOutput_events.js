// ATTENZIONE: definite funzioni comuni tra le grid di input e output perche' devono la stessa cosa (su path diversi)

function BuildInputOutputPath(path, row, col) {
	return path + "/modbusMapping[" + (row+1) + "]/" + m_InputOutputColumnsNodes[col];
}

function GridInputOutputGetElemS(path, grid, row, col) {
	// vado a prendere il nome dal parameter attraverso l'address
	if (col == gridInputOutputColumns.parameter) {
		// nell'XML c'e' l'ipa ma viene visualizzato il nome del parametro
		var ipa = GetNode(m_xmldoc, BuildInputOutputPath(path, row, gridInputOutputColumns.address));
		var query = gridDatapath + genfuncs.FormatMsg("/par[@ipa=%1]/@name", ipa);
		return GetNode(m_xmldoc, query);
	}
	else if (col == gridInputOutputColumns.address) {
		// nell'XML c'e' l'ipa ma viene visualizzato l'indirizzo modbus
		var ipa = GetNode(m_xmldoc, BuildInputOutputPath(path, row, col));
		var query = gridDatapath + genfuncs.FormatMsg("/par[@ipa=%1]/protocol/@commaddr", ipa);
		return GetNode(m_xmldoc, query);
	}
	else
		return GetNode(m_xmldoc, BuildInputOutputPath(path, row, col));
}

function GridInputOutputSetElemS(path, grid, row, col, s) {
	if (s == grid.Elem(row, col))
		return;

	SetNode(m_xmldoc, BuildInputOutputPath(path, row, col), s);

	SetModifiedFlag();
}

function GridInputOutputSetElemI(path, grid, row, col, i) {
	// in questo caso fa la stessa cosa della SetElemS... funzione definita per coerenza
	GridInputOutputSetElemS(path, grid, row, col, i);
}

function GridInputOutputGetRecordNum(path) {
	var list = m_xmldoc.selectNodes(path + "/*");
	if (list)
		return list.length;

	return 0;
}

// #region ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ eventi input ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function gridInput::GetElemS(row,col)
{
	gridInput.EventResult = GridInputOutputGetElemS(gridInputDatapath, gridInput, row, col);
}

function gridInput::SetElemS(row,col,s)
{
	GridInputOutputSetElemS(gridInputDatapath, gridInput, row, col, s);
}

function gridInput::GetElemI(row,col)
{
	gridInput.EventResult = GetNode(m_xmldoc, BuildInputOutputPath(gridInputDatapath, row, col));
}

function gridInput::SetElemI(row,col,i)
{
	GridInputOutputSetElemI(gridInputDatapath, gridInput, row, col, i);
}

function gridInput::GetRecordNum()
{
	gridInput.EventResult = GridInputOutputGetRecordNum(gridInputDatapath);
}
//#endregion

// #region ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ eventi output ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
function gridOutput::GetElemS(row,col)
{
	gridOutput.EventResult = GridInputOutputGetElemS(gridOutputDatapath, gridOutput, row, col);
}

function gridOutput::SetElemS(row,col,s)
{
	GridInputOutputSetElemS(gridOutputDatapath, gridOutput, row, col, s);
}

function gridOutput::GetElemI(row,col)
{
	gridOutput.EventResult = GetNode(m_xmldoc, BuildInputOutputPath(gridOutputDatapath, row, col));
}

function gridOutput::SetElemI(row,col,i)
{
	GridInputOutputSetElemI(gridOutputDatapath, gridOutput, row, col, i);
}

function gridOutput::GetRecordNum()
{
	 gridOutput.EventResult = GridInputOutputGetRecordNum(gridOutputDatapath);
}
//#endregion