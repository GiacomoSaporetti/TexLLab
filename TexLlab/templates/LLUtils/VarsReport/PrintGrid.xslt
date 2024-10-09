<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

<xsl:output method="html" omit-xml-declaration = "yes"/>

<!-- ____________________________________________ disattiva l'output dei nodi text non gestiti _______________________________ -->
<xsl:template match="text()" />

 
<!-- ____________________________________________ nodo radice del documento ______________________ -->

<xsl:template match="/print">
<html>
<head>

<style type="text/css">
.maintable 
{
	empty-cells: show;
	border-collapse: collapse;
	border-bottom: 1px solid #9aaaba;
	margin-bottom: 12px;
	margin-top: 15px;
}

.maintable th 
{	
	font: bold 14px Arial;
	color: #002157;
	text-align: center;
	padding: 5px;
	background-color: #d0e4ed;
	border: 1px solid #9aaaba;
	text-transform: capitalize;
}

.maintable td
{
	border-left: 1px solid #9aaaba;
	border-right: 1px solid #9aaaba;
	padding: 1px 5px 1px 5px;
	font: normal 12px Arial;
	color: #002157; 
	text-align: left; 
	white-space: nowrap;
}

.trColor1
{
	background-color: #ecf5f8;
}
.trColor2
{
	background-color: #ffffff;
}

#title
{
	font: bold 20px Arial;
	text-align: center;
}

#date {
	margin-top: 5px;
	display: block;
	text-align: center;
	font-family: Arial;
	font-size: 14px;
}

/* copiato dal CSS generico */
.FlatButton {
	background-color:#f0f0f0;
	border-radius:6px;
	border:1px solid #dcdcdc;
	display:inline-block;
	cursor:pointer;
	color:#666666;
	font-size:12px;
	padding:6px ;
	text-decoration:none;
	font: normal 12px Arial;
	color: #002157;
}

.bottone
{
	position: absolute;
	top: 10px;
	right: 10px;
}
/* stile particolare per la cella default diversa da value */
.diffDefault
{
	color: blue !important;
}
@media print
{
	.bottone
	{
		display: none;
	}
}
</style>
</head>

<body>
<xsl:for-each select="page">
	<div id="title"><xsl:value-of select="@title"/></div>
	<div id="date"><xsl:value-of select="@date"/></div>
	
	<a class="bottone FlatButton" href="#" onclick="window.print()">PRINT</a>
	
	<table class="maintable" cellpadding="0" cellspacing="0" border="0">
		<tr>
			<xsl:for-each select="var[1]/@*">
				<th><xsl:value-of select="name()"/></th>
			</xsl:for-each>
		</tr>

		<xsl:for-each select="var">
			<tr>
				<xsl:attribute name="class">
					<xsl:choose>
						<xsl:when test="position() mod 2 = 0">trColor1</xsl:when>
						<xsl:otherwise>trColor2</xsl:otherwise>
					</xsl:choose>
				</xsl:attribute>

				<xsl:for-each select="@*">
					<td>
						<xsl:value-of select="."/>
					</td>
				</xsl:for-each>
			</tr>
		</xsl:for-each>
	</table>
</xsl:for-each>
</body>
</html>
</xsl:template>

</xsl:stylesheet>
