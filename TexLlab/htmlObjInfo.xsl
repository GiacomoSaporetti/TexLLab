<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:t="text to be translated">
	<xsl:output method="html" encoding="UTF-8" indent="yes"/>
	<xsl:template match="/">
		<xsl:text disable-output-escaping="yes">&lt;!DOCTYPE html&gt;
		</xsl:text>
		<html>
			<head>
				<meta charset="utf-8" http-equiv="x-ua-compatible" content="IE=11"/>
				<link rel="stylesheet" type="text/css" href="htmlObjInfo.css"/>
				<script src="htmlObjInfo.js"/>
				<title>Object information</title>
			</head>
			<body>
				<xsl:apply-templates/>
				<script>
					InitPage()
				</script>
			</body>
		</html>
	</xsl:template>
	<!-- regole per POUs-->
	<xsl:template match="program|functionBlock|function|operator|method">
		<table>
			<xsl:choose>
				<xsl:when test="@icon">
					<tr>
						<th rowspan="1" style="border-right: 0;">
							<img>
								<xsl:attribute name="src">
									<xsl:value-of select='@icon'/>
								</xsl:attribute>
							</img>
						</th>
						<th colspan="2" height="30" style="border-left: 0;">
							<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
								<xsl:if test="name() = 'program'">
									<t:t>Program</t:t>:
								</xsl:if>
								<xsl:if test="name() = 'functionBlock'">
									<t:t>Function block</t:t>:
								</xsl:if>
								<xsl:if test="name() = 'function'">
									<t:t>Function</t:t>:
								</xsl:if>
								<xsl:if test="name() = 'operator'">
									<t:t>Operator</t:t>:
								</xsl:if>
								<xsl:if test="name() = 'method'">
									<t:t>Method</t:t>:
								</xsl:if>
							</span>
							<span style="font: bold 14px Arial;">
								<xsl:value-of select="@name"/>
							</span>
							<span class="Textual"> (ver.<xsl:value-of select="@version"/>, </span>
							<xsl:apply-templates select="sourceCode"/>
							<span class="Textual">)</span>
							<xsl:apply-templates select="@location"/>
							<xsl:apply-templates select="@WksLocation"/>
							<xsl:if test="@creationDate">
								<div style="margin-top:5px;">
									<table class="dateTable" cellspacing="0" cellpadding="0">
										<tr>
											<td width="50%">
												<t:t>Creation date:</t:t>
											</td>
											<td width="50%" style="text-align: left;">
												<xsl:value-of select='@creationDate'/>
											</td>
										</tr>
										<tr>
											<td>
												<t:t>Last modified date:</t:t>
											</td>
											<td style="text-align: left;">
												<xsl:value-of select='@lastModifiedDate'/>
											</td>
										</tr>
									</table>
								</div>
							</xsl:if>
						</th>
					</tr>
					<xsl:if test="title">
						<tr>
							<th colspan="3">
								<xsl:value-of select='title'/>
							</th>
						</tr>
					</xsl:if>
				</xsl:when>
				<xsl:otherwise>
					<!-- non ha immagine -->
					<tr>
						<th colspan="2">
							<div>
								<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
									<xsl:if test="name() = 'program'">
										<t:t>Program</t:t>:
									</xsl:if>
									<xsl:if test="name() = 'functionBlock'">
										<t:t>Function block</t:t>:
									</xsl:if>
									<xsl:if test="name() = 'function'">
										<t:t>Function</t:t>:
									</xsl:if>
									<xsl:if test="name() = 'operator'">
										<t:t>Operator</t:t>:
									</xsl:if>
									<xsl:if test="name() = 'method'">
										<t:t>Method</t:t>:
									</xsl:if>
								</span>
								<span style="font: bold 14px Arial;">
									<xsl:value-of select="@name"/>
								</span>
								<span class="Textual"> (ver.<xsl:value-of select="@version"/>, </span>
								<xsl:apply-templates select="sourceCode"/>
								<span class="Textual">)</span>
								<xsl:apply-templates select="@location"/>
								<xsl:apply-templates select="@WksLocation"/>
								<xsl:if test="@creationDate">
									<div>
										<table class="dateTable" cellspacing="0" cellpadding="0">
											<tr>
												<td width="50%">
													<t:t>Creation date:</t:t>
												</td>
												<td width="50%" style="text-align: left;">
													<xsl:value-of select='@creationDate'/>
												</td>
											</tr>
											<tr>
												<td>
													<t:t>Last modified date:</t:t>
												</td>
												<td style="text-align: left;">
													<xsl:value-of select='@lastModifiedDate'/>
												</td>
											</tr>
										</table>
									</div>
								</xsl:if>
							</div>
						</th>
					</tr>
					<xsl:if test="title">
						<tr>
							<th colspan="3">
								<xsl:value-of select='title'/>
							</th>
						</tr>
					</xsl:if>
				</xsl:otherwise>
			</xsl:choose>
		</table>
		<br/>
		<xsl:apply-templates select="@excludeFromBuild"/>
		<p>
			<xsl:if test="extendslist">
				<span class="Textual_big" style="display: inline-block;margin-right:5px;">
					<t:t>Extends</t:t>:
				</span>
				<div style="overflow: auto;white-space:nowrap;" class="Textual_big">
					<xsl:apply-templates select="extendslist"/>
				</div>
			</xsl:if>
		</p>
		<p>
			<xsl:if test="interfaces">
				<span class="Textual_big" style="display: inline-block;margin-right:5px;">
					<t:t>Implements</t:t>:
				</span>
				<div style="overflow: auto;white-space:nowrap;" class="Textual_big">
					<xsl:apply-templates select="interfaces"/>
				</div>
			</xsl:if>
		</p>
		<xsl:apply-templates select="returnValue"/>
		<!-- variabili interessate alla trasformazione-->
		<xsl:apply-templates select="vars/inputVars | vars/outputVars | vars/inoutVars"/>
		<br/>
		<xsl:apply-templates select="descr"/>
		<p>
			<xsl:if test="methods">
				<span class="Textual_big" style="display: inline-block;margin-right:5px;">
					<t:t>methods</t:t>:
					<xsl:apply-templates select="methods"/>
				</span>
			</xsl:if>
		</p>
	</xsl:template>
	<xsl:template match="macro">
		<table>
			<tr>
				<th colspan="2">
					<div>
						<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
							<t:t>Macro</t:t>:
						</span>
						<span style="font: bold 14px Arial;">
							<xsl:value-of select="@name"/>
						</span>
						<span class="Textual"> (ver.<xsl:value-of select="@version"/>, </span>
						<xsl:apply-templates select="sourceCode"/>
						<span class="Textual">)</span>
						<xsl:apply-templates select="@location"/>
						<xsl:apply-templates select="@WksLocation"/>
						<xsl:if test="@creationDate">
							<div>
								<table class="dateTable" cellspacing="0" cellpadding="0">
									<tr>
										<td width="50%">
											<t:t>Creation date:</t:t>
										</td>
										<td width="50%" style="text-align: left;">
											<xsl:value-of select='@creationDate'/>
										</td>
									</tr>
									<tr>
										<td>
											<t:t>Last modified date:</t:t>
										</td>
										<td style="text-align: left;">
											<xsl:value-of select='@lastModifiedDate'/>
										</td>
									</tr>
								</table>
							</div>
						</xsl:if>
					</div>
				</th>
			</tr>
			<xsl:if test="title">
				<tr>
					<th colspan="3">
						<xsl:value-of select='title'/>
					</th>
				</tr>
			</xsl:if>
		</table>
		<br/>
		<xsl:apply-templates select="@excludeFromBuild"/>
		<xsl:apply-templates select="descr"/>
		<xsl:apply-templates select="parameters"/>
	</xsl:template>
	<!-- il nodo struct ha una root structs per via dell'implementazione del metodo di salvataggio xml-->
	<xsl:template match="structs/struct">
		<table>
			<tr>
				<th colspan="2">
					<div>
						<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
							<t:t>Structure</t:t>:
						</span>
						<span style="font: bold 14px Arial;">
							<xsl:value-of select="@name"/>
						</span>
						<span class="Textual"> (ver.<xsl:value-of select="@version"/>
						</span>
						<span class="Textual">)</span>
						<xsl:apply-templates select="@location"/>
						<xsl:apply-templates select="../@WksLocation"/>
						<xsl:if test="@creationDate">
							<div>
								<table class="dateTable" cellspacing="0" cellpadding="0">
									<tr>
										<td width="50%">
											<t:t>Creation date:</t:t>
										</td>
										<td width="50%" style="text-align: left;">
											<xsl:value-of select='@creationDate'/>
										</td>
									</tr>
									<tr>
										<td>
											<t:t>Last modified date:</t:t>
										</td>
										<td style="text-align: left;">
											<xsl:value-of select='@lastModifiedDate'/>
										</td>
									</tr>
								</table>
							</div>
						</xsl:if>
					</div>
				</th>
			</tr>
			<xsl:if test="title">
				<tr>
					<th colspan="3">
						<xsl:value-of select='title'/>
					</th>
				</tr>
			</xsl:if>
		</table>
		<br/>
		<xsl:apply-templates select="@excludeFromBuild"/>
		<xsl:apply-templates select="descr"/>
		<xsl:apply-templates select="vars"/>
	</xsl:template>
	<!-- il nodo enum ha una root enums per via dell'implementazione del metodo di salvataggio xml-->
	<xsl:template match="enums/enum">
		<table>
			<tr>
				<th colspan="2">
					<div>
						<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
							<t:t>Enumeration</t:t>:
						</span>
						<span style="font: bold 14px Arial;">
							<xsl:value-of select="@name"/>
						</span>
						<span class="Textual"> (ver.<xsl:value-of select="@version"/>, <span style="font: bold 14px Arial;"><xsl:value-of select="@baseType"/></span>
						</span>
						<span class="Textual">)</span>
						<xsl:apply-templates select="@location"/>
						<xsl:apply-templates select="../@WksLocation"/>
						<xsl:if test="@creationDate">
							<div>
								<table class="dateTable" cellspacing="0" cellpadding="0">
									<tr>
										<td width="50%">
											<t:t>Creation date:</t:t>
										</td>
										<td width="50%" style="text-align: left;">
											<xsl:value-of select='@creationDate'/>
										</td>
									</tr>
									<tr>
										<td>
											<t:t>Last modified date:</t:t>
										</td>
										<td style="text-align: left;">
											<xsl:value-of select='@lastModifiedDate'/>
										</td>
									</tr>
								</table>
							</div>
						</xsl:if>
					</div>
				</th>
			</tr>
			<xsl:if test="title">
				<tr>
					<th colspan="3">
						<xsl:value-of select='title'/>
					</th>
				</tr>
			</xsl:if>
		</table>
		<br/>
		<xsl:apply-templates select="@excludeFromBuild"/>
		<xsl:apply-templates select="descr"/>
		<xsl:apply-templates select="elements"/>
	</xsl:template>
	<!-- il nodo typedef ha una root typedefs per via dell'implementazione del metodo di salvataggio xml-->
	<xsl:template match="typedefs/typedef">
		<table>
			<tr>
				<th colspan="2" height="30">
					<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
						<t:t>Typedef</t:t>:
					</span>
					<span style="font: bold 14px Arial;">
						<xsl:value-of select="@name"/>
					</span>
					<span class="Textual"> (ver.<xsl:value-of select="@version"/>)</span>
					<br/>
					<span class="Textual_big">
						<t:t>Type22</t:t>:</span>
					<xsl:call-template name="printVarType"/>
					<xsl:apply-templates select="@location"/>
					<xsl:apply-templates select="@WksLocation"/>
					<xsl:if test="@creationDate">
						<div>
							<table class="dateTable" cellspacing="0" cellpadding="0">
								<tr>
									<td width="50%">
										<t:t>Creation date:</t:t>
									</td>
									<td width="50%" style="text-align: left;">
										<xsl:value-of select='@creationDate'/>
									</td>
								</tr>
								<tr>
									<td>
										<t:t>Last modified date:</t:t>
									</td>
									<td style="text-align: left;">
										<xsl:value-of select='@lastModifiedDate'/>
									</td>
								</tr>
							</table>
						</div>
					</xsl:if>
				</th>
			</tr>
			<xsl:if test="title">
				<tr>
					<th colspan="3">
						<xsl:value-of select='title'/>
					</th>
				</tr>
			</xsl:if>
		</table>
		<br/>
		<xsl:apply-templates select="@excludeFromBuild"/>
		<xsl:apply-templates select="descr"/>
	</xsl:template>
	<!-- il nodo subrange ha una root subranges per via dell'implementazione del metodo di salvataggio xml-->
	<xsl:template match="subranges/subrange|typedefs/typedef">
		<table>
			<tr>
				<th colspan="2" height="30">
					<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
						<xsl:if test="name() = 'subrange'">
							<t:t>Subrange</t:t>:
						</xsl:if>
						<xsl:if test="name() = 'typedef'">
							<t:t>Typedef</t:t>:
						</xsl:if>
					</span>
					<span style="font: bold 14px Arial;">
						<xsl:value-of select="@name"/>
					</span>
					<span>
						Type:<xsl:value-of select="@type"/>
					</span>
					<span class="Textual"> (ver.<xsl:value-of select="@version"/>)</span>
					<xsl:apply-templates select="@location"/>
					<xsl:apply-templates select="../@WksLocation"/>
					<xsl:if test="@creationDate">
						<div>
							<table class="dateTable" cellspacing="0" cellpadding="0">
								<tr>
									<td width="50%">
										<t:t>Creation date:</t:t>
									</td>
									<td width="50%" style="text-align: left;">
										<xsl:value-of select='@creationDate'/>
									</td>
								</tr>
								<tr>
									<td>
										<t:t>Last modified date:</t:t>
									</td>
									<td style="text-align: left;">
										<xsl:value-of select='@lastModifiedDate'/>
									</td>
								</tr>
							</table>
						</div>
					</xsl:if>
				</th>
			</tr>
			<xsl:if test="title">
				<tr>
					<th colspan="3">
						<xsl:value-of select='title'/>
					</th>
				</tr>
			</xsl:if>
		</table>
		<br/>
		<xsl:apply-templates select="@excludeFromBuild"/>
		<xsl:apply-templates select="descr"/>
		<br/>
		<xsl:if test="name() = 'subrange'">
			<table>
				<tr>
					<th>
						<t:t>Min value</t:t>
					</th>
					<th>
						<t:t>Max value</t:t>
					</th>
				</tr>
				<tr>
					<td>
						<xsl:value-of select="minValue"/>
					</td>
					<td>
						<xsl:value-of select="maxValue"/>
					</td>
				</tr>
			</table>
		</xsl:if>
	</xsl:template>
	<xsl:template match="title">
		<p>
			<span class="Textual_big">
				<t:t>Title</t:t>: </span>
			<xsl:value-of select="."/>
		</p>
	</xsl:template>
	<xsl:template match="descr">
		<table class="tableDescr" cellspacing="0" cellpadding="0">
			<tr>
				<td>
					<span class="Textual_big">
						<t:t>Description</t:t>: </span>
				</td>
			</tr>
			<tr>
				<td class="cell-breakWord">
					<xsl:choose>
						<!-- ricerca parola chiave per capire se la string contiene codice html-->
						<xsl:when test="substring(.,1,6) = '&lt;HTML&gt;'">
							<xsl:value-of select="substring(.,7)" disable-output-escaping="yes"/>
						</xsl:when>
						<xsl:otherwise>
							<xsl:call-template name="break">
								<xsl:with-param name="text" select="."/>
							</xsl:call-template>
						</xsl:otherwise>
					</xsl:choose>
				</td>
			</tr>
		</table>
	</xsl:template>
	<xsl:template match="extendslist/extends">
		<xsl:choose>
			<xsl:when test="@inherited = 'true'">
				<img src="LLABRRESPNG/#1437" class="InterfaceImg"/>
				<!-- IDB_RIGHT_ARROW = 1437 -->
				<span class="extends inherited">
					<xsl:value-of select="@name"/>
				</span>
			</xsl:when>
			<xsl:otherwise>
				<span class="extends">
					<xsl:value-of select="@name"/>
				</span>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="interfaces/interface">
		<span class="interface">
			<xsl:value-of select="@name"/>
		</span>
		<xsl:apply-templates select="./baseinterface"/>
		<br/>
		<br/>
	</xsl:template>
	<xsl:template match="baseinterface">
		<img src="LLABRRESPNG/#1437" class="InterfaceImg"/>
		<!-- IDB_RIGHT_ARROW = 1437 -->
		<span class="interface baseInterface">
			<xsl:value-of select="@name"/>
		</span>
		<xsl:apply-templates select="./baseinterface"/>
	</xsl:template>
	<xsl:template match="initValue">
		<p>
			<span class="Textual_big">
				<t:t>Init value</t:t>: </span>
			<xsl:value-of select="."/>
		</p>
	</xsl:template>
	<xsl:template match="sourceCode">
		<span class="Textual">
			<b>
				<xsl:if test="@type = 'FBD'">
			FBD<!-- <img src="LLABRRESBMP/#5168" class="langImg"/>  -->
				</xsl:if>
				<xsl:if test="@type = 'SFC'">
			SFC<!-- <img src="LLABRRESBMP/#5163" class="langImg"/>  -->
				</xsl:if>
				<xsl:if test="@type = 'LD'">
			LD<!-- <img src="LLABRRESBMP/#5172" class="langImg"/>  -->
				</xsl:if>
				<xsl:if test="@type = 'LD2'">
			LD<!-- <img src="LLABRRESBMP/#5172" class="langImg"/>  -->
				</xsl:if>
				<xsl:if test="@type = 'ST'">
			ST<!-- <img src="LLABRRESBMP/#5171" class="langImg"/> -->
				</xsl:if>
				<xsl:if test="@type = 'IL'">
			IL<!-- <img src="LLABRRESBMP/#5170" class="langImg"/>  -->
				</xsl:if>
				<xsl:if test="@type = 'EMBEDDED'">
			EMBEDDED
			</xsl:if>
			</b>
		</span>
	</xsl:template>
	<xsl:template match="returnValue">
		<p>
			<span class="Textual_big">
				<t:t>Return value</t:t>: </span>
			<xsl:value-of select="."/>
		</p>
	</xsl:template>
	<xsl:template match="inputVars | outputVars | inoutVars | struct/vars">
		<p class="Textual_big" style="margin-bottom:5px;">
			<xsl:if test="local-name() = 'inputVars'">
				<t:t>Input</t:t>:</xsl:if>
			<xsl:if test="local-name() = 'outputVars'">
				<t:t>Output</t:t>:</xsl:if>
			<xsl:if test="local-name() = 'inoutVars'">
				<t:t>Input/Output</t:t>:</xsl:if>
		</p>
		<table>
			<tr>
				<th width="25%">
					<t:t>Name</t:t>
				</th>
				<th width="25%">
					<t:t>Type</t:t>
				</th>
				<th width="50%">
					<t:t>Description</t:t>
				</th>
			</tr>
			<xsl:for-each select="var | group/var">
				<tr>
					<td>
						<xsl:value-of select="@name"/>
					</td>
					<td>
						<xsl:call-template name="printVarType"/>
					</td>
					<td>
						<xsl:value-of select="descr"/>
					</td>
				</tr>
			</xsl:for-each>
		</table>
	</xsl:template>
	<xsl:template match="enum/elements">
		<br/>
		<table>
			<tr>
				<th width="25%">
					<t:t>Name</t:t>
				</th>
				<th width="25%">
					<t:t>Value</t:t>
				</th>
				<th width="50%">
					<t:t>Description</t:t>
				</th>
			</tr>
			<xsl:for-each select="element">
				<tr>
					<td>
						<xsl:value-of select="@name"/>
					</td>
					<td>
						<xsl:value-of select="value"/>
					</td>
					<td>
						<xsl:value-of select="descr"/>
					</td>
				</tr>
			</xsl:for-each>
		</table>
	</xsl:template>
	<xsl:template match="macro/parameters">
		<p class="elements Textual_big">
			<t:t>Parameters</t:t>:</p>
		<table>
			<tr>
				<th width="25%">
					<t:t>Name</t:t>
				</th>
				<th width="75%">
					<t:t>Description</t:t>
				</th>
			</tr>
			<xsl:for-each select="parameter">
				<tr>
					<td>
						<xsl:value-of select="@name"/>
					</td>
					<td>
						<xsl:value-of select="descr"/>
					</td>
				</tr>
			</xsl:for-each>
		</table>
	</xsl:template>
	<xsl:template match="interface/methodPrototypes">
		<p class="elements Textual_big">
			<t:t>Method prototypes</t:t>:</p>
		<table>
			<tr>
				<th width="65%">
					<t:t>Name</t:t>
				</th>
				<th width="35%">
					<t:t>Return type</t:t>
				</th>
			</tr>
			<xsl:for-each select="methodPrototype">
				<tr>
					<td>
						<xsl:value-of select="@name"/>
					</td>
					<td>
						<xsl:value-of select="returnValue"/>
					</td>
				</tr>
			</xsl:for-each>
		</table>
	</xsl:template>
	<xsl:template match="var | const">
		<table>
			<tr>
				<th colspan="2" height="30">
					<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
						<xsl:if test="name() = 'var'">
							<t:t>Variable</t:t>:
						</xsl:if>
						<xsl:if test="name() = 'const'">
							<t:t>Constant</t:t>:
						</xsl:if>
					</span>
					<span style="font: bold 14px Arial;">
						<xsl:value-of select="@name"/>
					</span>
					<xsl:apply-templates select="@location"/>
					<xsl:apply-templates select="@WksLocation"/>
					<xsl:if test="group">
						<div style="margin-top:5px;margin-bottom:5px;">
							<t:t>Group:</t:t>&#160;
							<xsl:value-of select='group'/>
						</div>
					</xsl:if>
				</th>
			</tr>
			<xsl:if test="title">
				<th colspan="2">
					<xsl:value-of select='title'/>
				</th>
			</xsl:if>
		</table>
		<br/>
		<xsl:apply-templates select="@excludeFromBuild"/>
		<p>
			<span class="Textual_big">
				<t:t>Type</t:t>:</span>
			<xsl:call-template name="printVarType"/>
		</p>
		<p>
			<span class="Textual_big">
				<t:t>Address</t:t>: </span>
			<xsl:choose>
				<xsl:when test="address">
				%<xsl:value-of select="address/@type"/>
					<xsl:value-of select="address/@typeVar"/>
					<xsl:value-of select="address/@index"/>.<xsl:value-of select="address/@subIndex"/>
				</xsl:when>
				<xsl:otherwise>
					<t:t>automatic</t:t>
				</xsl:otherwise>
			</xsl:choose>
		</p>
		<xsl:apply-templates select="initValue"/>
		<p>
			<span class="Textual_big">
				<t:t>Description</t:t>: </span>
			<xsl:value-of select="descr"/>
		</p>
	</xsl:template>
	<xsl:template match="methods">
		<table class="table2">
			<tr>
				<th width="25%">
					<t:t>Name</t:t>
				</th>
				<th width="25%">
					<t:t>Return type</t:t>
				</th>
				<th width="50%">
					<t:t>Description</t:t>
				</th>
			</tr>
			<tr>
				<xsl:for-each select="method">
					<tr>
						<td>
							<xsl:value-of select="@name"/>
						</td>
						<td>
							<xsl:value-of select="returnValue"/>
						</td>
						<td>
							<xsl:choose>
								<xsl:when test="title">
									<xsl:value-of select="title"/>
								</xsl:when>
								<xsl:otherwise>
									<xsl:choose>
										<xsl:when test="string-length(descr) > 30">
											<xsl:value-of select="substring(descr, 1, 27)"/>...
										</xsl:when>
										<xsl:otherwise>
											<xsl:value-of select="descr"/>
										</xsl:otherwise>
									</xsl:choose>
								</xsl:otherwise>
							</xsl:choose>
						</td>
					</tr>
				</xsl:for-each>
			</tr>
		</table>
		<p>
			<xsl:apply-templates select="@excludeFromBuild"/>
		</p>
	</xsl:template>
	<xsl:template match="methodPrototype">
		<table>
			<table>
				<tr>
					<th colspan="2" height="30">
						<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
							<t:t>Method prototype</t:t>:
					</span>
						<span style="font: bold 14px Arial;">
							<xsl:value-of select="@name"/>
							<span class="Textual"> (ver.<xsl:value-of select="@version"/>)</span>
						</span>
						<xsl:apply-templates select="@location"/>
						<xsl:apply-templates select="@WksLocation"/>
						<xsl:if test="@creationDate">
							<div style="margin-top:5px;">
								<table class="dateTable" cellspacing="0" cellpadding="0">
									<tr>
										<td width="50%">
											<t:t>Creation date:</t:t>
										</td>
										<td width="50%" style="text-align: left;">
											<xsl:value-of select='@creationDate'/>
										</td>
									</tr>
									<tr>
										<td>
											<t:t>Last modified date:</t:t>
										</td>
										<td style="text-align: left;">
											<xsl:value-of select='@lastModifiedDate'/>
										</td>
									</tr>
								</table>
							</div>
						</xsl:if>
					</th>
				</tr>
				<xsl:if test="title">
					<th colspan="2">
						<xsl:value-of select='title'/>
					</th>
				</xsl:if>
			</table>
			<xsl:if test="title">
				<tr>
					<th colspan="3">
						<xsl:value-of select='title'/>
					</th>
				</tr>
			</xsl:if>
		</table>
		<br/>
		<xsl:apply-templates select="@excludeFromBuild"/>
		<xsl:apply-templates select="returnValue"/>
		<br/>
		<xsl:apply-templates select="descr"/>
		<!-- variabili interessate alla trasformazione-->
		<xsl:apply-templates select="vars/inputVars"/>
	</xsl:template>
	<xsl:template match="interface">
		<table>
			<tr>
				<th colspan="2" height="30">
					<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
						<t:t>Interface</t:t>:
					</span>
					<span style="font: bold 14px Arial;">
						<xsl:value-of select="@name"/>
						<span class="Textual"> (ver.<xsl:value-of select="@version"/>)</span>
					</span>
					<xsl:apply-templates select="@location"/>
					<xsl:apply-templates select="@WksLocation"/>
					<xsl:if test="@creationDate">
						<div style="margin-top:5px;">
							<table class="dateTable" cellspacing="0" cellpadding="0">
								<tr>
									<td width="50%">
										<t:t>Creation date:</t:t>
									</td>
									<td width="50%" style="text-align: left;">
										<xsl:value-of select='@creationDate'/>
									</td>
								</tr>
								<tr>
									<td>
										<t:t>Last modified date:</t:t>
									</td>
									<td style="text-align: left;">
										<xsl:value-of select='@lastModifiedDate'/>
									</td>
								</tr>
							</table>
						</div>
					</xsl:if>
				</th>
			</tr>
			<xsl:if test="title">
				<th colspan="2">
					<xsl:value-of select='title'/>
				</th>
			</xsl:if>
		</table>
		<br/>
		<xsl:apply-templates select="@excludeFromBuild"/>
		<p>
			<xsl:if test="@extends">
				<span class="Textual_big" style="display: inline-block;">
					<t:t>Extends</t:t>:
				</span>
				<div style="overflow: auto;white-space:nowrap;" class="Textual_big">
					<span class="extends">
						<xsl:value-of select="@extends"/>
					</span>
				</div>
			</xsl:if>
		</p>
		
		<xsl:apply-templates select="descr"/>
		<xsl:apply-templates select="methodPrototypes"/>
	</xsl:template>
	<xsl:template match="lib">
		<table>
			<tr>
				<th colspan="2">
					<div>
						<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
							<t:t>Library</t:t>:
						</span>
						<span style="font: bold 14px Arial;">
							<xsl:value-of select="@name"/>
						</span>
						<span class="Textual"> (ver.<xsl:value-of select="@version"/>
						</span>
						<span class="Textual">)</span>
					</div>
				</th>
			</tr>
		</table>
		<br/>
		<xsl:apply-templates select="descr"/>
	</xsl:template>
	<!-- INFORMAZIONI SUL PROGETTO -->
	<xsl:template match="plcProject">
		<table>
			<tr>
				<th colspan="2" height="30">
					<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
						<t:t>Project</t:t>:
					</span>
					<span style="font: bold 14px Arial;">
						<xsl:value-of select="release/@value"/>
					</span>
					<div style="margin-top:5px;">
						<table class="dateTable" cellspacing="0" cellpadding="0">
							<tr>
								<td width="50%">
									<t:t>Author:</t:t>
								</td>
								<td width="50%" style="text-align: left;">
									<xsl:value-of select='author/@value'/>
								</td>
							</tr>
							<tr>
								<td>
									<t:t>Note:</t:t>
								</td>
								<td style="text-align: left;">
									<xsl:value-of select='note/@value'/>
								</td>
							</tr>
						</table>
					</div>
				</th>
			</tr>
			<tr>
				<td colspan="2" style="text-align: center;font: bold 12px Arial;" class="Textual_big">TARGET INFORMATION</td>
			</tr>
			<tr>
				<td>Name</td>
				<td>
					<span style="font: bold 12px Arial;">
						<xsl:value-of select="target/@name"/>
					</span>
				</td>
			</tr>
			<tr>
				<td>CPU</td>
				<td>
					<span style="font: bold 12px Arial;">
						<xsl:value-of select="target/@CPUname"/>
					</span>
				</td>
			</tr>
			<tr>
				<td>Description</td>
				<td>
					<span style="font: bold 12px Arial;">
						<xsl:value-of select="target/@descr"/>
					</span>
				</td>
			</tr>
			<tr>
				<td colspan="2" style="text-align: center;font: bold 12px Arial;" class="Textual_big">COMMUNICATION SETTINGS</td>
			</tr>
			<tr>
				<td>Protocol</td>
				<td>
					<span id="CommString_protocol" style="font: bold 12px Arial;">Unknown</span>
				</td>
			</tr>
			<tr>
				<td>Address</td>
				<td>
					<span id="CommString_address" style="font: bold 12px Arial;">Unknown</span>
				</td>
			</tr>
			<tr>
				<td>Port</td>
				<td>
					<span id="CommString_portNum" style="font: bold 12px Arial;">Unknown</span>
				</td>
			</tr>
			<tr>
				<td>Timeout</td>
				<td>
					<span id="CommString_timeout" style="font: bold 12px Arial;">Unknown</span>
				</td>
			</tr>
			<!-- <tr> -->
			<!-- <td>Options</td> -->
			<!-- <td><span id="CommString_protocolOptions" style="font: bold 12px Arial;">Unknown</span></td>				 -->
			<!-- </tr> -->
			<span style="display:none" id="CommString">
				<xsl:value-of select="commSettings/@value"/>
			</span>
			<tr>
				<td colspan="2" style="text-align: center;font: bold 12px Arial;" class="Textual_big">PROJECT OPTIONS</td>
			</tr>
			<tr>
				<td>Project type</td>
				<td>
					<span style="font: bold 12px Arial;">
						<xsl:if test="prjXPLCType/@value = '0'">
							Single file
						</xsl:if>
						<xsl:if test="prjXPLCType/@value = '1'">
							Multiple files (XPLC)
						</xsl:if>
					</span>
				</td>
			</tr>
			<tr>
				<td>Case sensitivity</td>
				<td>
					<span style="font: bold 12px Arial;">
						<xsl:if test="prjcase/@value = '0'">
							NO
						</xsl:if>
						<xsl:if test="prjcase/@value = '1'">
							YES
						</xsl:if>
					</span>
				</td>
			</tr>
			<tr>
				<td>Cross reference enabled</td>
				<td>
					<span style="font: bold 12px Arial;">
						<xsl:if test="prjcrossRef/@value = '0'">
							NO
						</xsl:if>
						<xsl:if test="prjcrossRef/@value = '1'">
							YES
						</xsl:if>
					</span>
				</td>
			</tr>
			<tr>
				<td>Source code download time</td>
				<td>
					<span style="font: bold 12px Arial;">
						<xsl:if test="prjSourceCodeDownTime/@value = '0'">
							On PLC application download
						</xsl:if>
						<xsl:if test="prjSourceCodeDownTime/@value = '1'">
							Before disconnection
						</xsl:if>
						<xsl:if test="prjSourceCodeDownTime/@value = '2'">
							Never
						</xsl:if>
					</span>
				</td>
			</tr>
			<tr>
				<td>Debug symbols download time</td>
				<td>
					<span style="font: bold 12px Arial;">
						<xsl:if test="prjSymbolCodeDownTime/@value = '0'">
							On PLC application download
						</xsl:if>
						<xsl:if test="prjSymbolCodeDownTime/@value = '1'">
							Before disconnection
						</xsl:if>
						<xsl:if test="prjSymbolCodeDownTime/@value = '2'">
							Never
						</xsl:if>
					</span>
				</td>
			</tr>
		</table>
		<br/>
	</xsl:template>
	<xsl:template name="break">
		<xsl:param name="text" select="string(.)"/>
		<xsl:choose>
			<xsl:when test="contains($text, '&#xa;')">
				<xsl:value-of select="substring-before($text, '&#xa;')"/>
				<br/>
				<xsl:call-template name="break">
					<xsl:with-param name="text" select="substring-after($text, '&#xa;')"/>
				</xsl:call-template>
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="$text"/>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template name="printVarType">
		<xsl:choose>
			<xsl:when test="@dim0 or @idxMin0">
				ARRAY[
				<xsl:choose>
					<xsl:when test="@dim0">0..<xsl:value-of select="@dim0 - 1"/>
					</xsl:when>
					<xsl:when test="@idxMin0">
						<xsl:value-of select="@idxMin0"/>..<xsl:value-of select="@idx0"/>
					</xsl:when>
				</xsl:choose>
				<xsl:choose>
					<xsl:when test="@dim1">, 0..<xsl:value-of select="@dim1 - 1"/>
					</xsl:when>
					<xsl:when test="@idxMin1">, <xsl:value-of select="@idxMin1"/>..<xsl:value-of select="@idx1"/>
					</xsl:when>
				</xsl:choose>
				<xsl:choose>
					<xsl:when test="@dim2">, 0..<xsl:value-of select="@dim2 - 1"/>
					</xsl:when>
					<xsl:when test="@idxMin2">, <xsl:value-of select="@idxMin2"/>..<xsl:value-of select="@idx2"/>
					</xsl:when>
				</xsl:choose>
				] OF <xsl:value-of select="@type"/>
			</xsl:when>
			<xsl:when test="@length">
				STRING[<xsl:value-of select="@length"/>]
			</xsl:when>
			<xsl:otherwise>
				<xsl:value-of select="@type"/>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:template>
	<xsl:template match="globalVars/group">
		<table>
			<tr>
				<th colspan="2" height="30">
					<span class="Textual_Header" style="display: inline-block;margin-right:5px;">
						<t:t>Global Variables Group</t:t>:
					</span>
					<span style="font: bold 14px Arial;">
						<xsl:value-of select="@name"/>
						<span class="Textual"> (ver.<xsl:value-of select="@version"/>)</span>
					</span>
					<xsl:apply-templates select="@location"/>
					<xsl:apply-templates select="../@WksLocation"/>
					<xsl:if test="@creationDate">
						<div style="margin-top:5px;">
							<table class="dateTable" cellspacing="0" cellpadding="0">
								<tr>
									<td width="50%">
										<t:t>Creation date:</t:t>
									</td>
									<td width="50%" style="text-align: left;">
										<xsl:value-of select='@creationDate'/>
									</td>
								</tr>
								<tr>
									<td>
										<t:t>Last modified date:</t:t>
									</td>
									<td style="text-align: left;">
										<xsl:value-of select='@lastModifiedDate'/>
									</td>
								</tr>
							</table>
						</div>
					</xsl:if>
				</th>
			</tr>
			<xsl:if test="title">
				<th colspan="2">
					<xsl:value-of select='title'/>
				</th>
			</xsl:if>
		</table>
		<br/>
		<xsl:apply-templates select="@excludeFromBuild"/>
		<br/>
		<table>
			<tr>
				<th width="25%">
					<t:t>Name</t:t>
				</th>
				<th width="15%">
					<t:t>Type</t:t>
				</th>
				<th width="30%">
					<t:t>Address</t:t>
				</th>
				<th width="30%">
					<t:t>Description</t:t>
				</th>
			</tr>
			<xsl:for-each select="var | const">
				<tr>
					<td>
						<xsl:value-of select="@name"/>
					</td>
					<td>
						<xsl:call-template name="printVarType"/>
					</td>
					<td>
						<xsl:choose>
							<xsl:when test="address">
				%<xsl:value-of select="address/@type"/>
								<xsl:value-of select="address/@typeVar"/>
								<xsl:value-of select="address/@index"/>.<xsl:value-of select="address/@subIndex"/>
							</xsl:when>
							<xsl:otherwise>
								<t:t>automatic</t:t>
							</xsl:otherwise>
						</xsl:choose>
					</td>
					<td>
						<xsl:value-of select="descr"/>
					</td>
				</tr>
			</xsl:for-each>
		</table>
		<br/>
		<xsl:apply-templates select="descr"/>
	</xsl:template>
	<xsl:template match="@location">
		<div style="margin-top:5px;margin-bottom:5px;">
			<t:t>Location:</t:t>&#160;
			<xsl:value-of select='.'/>
		</div>
	</xsl:template>
	<xsl:template match="@WksLocation">
		<xsl:if test="(../@WksLocation != '')">
		<div style="margin-top:5px;margin-bottom:5px;">
			<t:t>Folder:</t:t>&#160;
			<xsl:value-of select='.'/>
		</div>
		</xsl:if>
	</xsl:template>
	<xsl:template match="@excludeFromBuild">
		<xsl:if test="(../@excludeFromBuild != 'FALSE') or (../@excludeFromBuildIfNotDef != '')">
		<table class="" cellspacing="0" cellpadding="0">
			<tr>
				<th colspan="2">
					<t:t>Exclude from build options:</t:t>
				</th>
			</tr>
			<tr>
				<th>
					<t:t>Exclude</t:t>
				</th>
				<th>
					<t:t>Exclude IF NOT DEF</t:t>
				</th>
			</tr>
			<tr>
				<td>
					<xsl:if test="(../@excludeFromBuild != 'FALSE')">
					<xsl:value-of select='.'/>
					</xsl:if>
				</td>
				<td>
					<xsl:value-of select='../@excludeFromBuildIfNotDef'/>
				</td>
			</tr>
		</table>
		</xsl:if>
	</xsl:template>
</xsl:stylesheet>