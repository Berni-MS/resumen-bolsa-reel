import html, os
CSS = """
:root{--ink:#0F1B33;--green:#35D07F;--red:#FF5247;--muted:#9FB0CC;--card:#16264A;--soft:#DCE5F5}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--soft);font:17px/1.55 'Hanken Grotesk',system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:32px 20px 64px}
h1,h2{font-family:'Big Shoulders Display',sans-serif;font-weight:900;color:#fff;line-height:1.05;margin:0}
h1{font-size:clamp(40px,9vw,64px)}h1 em{font-style:normal;color:var(--green)}h2{font-size:32px;margin:36px 0 10px}
.top{color:var(--muted);font-weight:700;font-size:15px;margin-bottom:18px}.top a{color:var(--green);text-decoration:none}
p{margin:10px 0}.lead{font-size:19px;color:var(--soft)}
.card{background:var(--card);border-radius:18px;padding:18px 20px;margin:14px 0}
ul.chk{list-style:none;padding:0;margin:10px 0}ul.chk li{padding:9px 0 9px 36px;position:relative;border-bottom:1px solid rgba(159,176,204,.18)}
ul.chk li:before{content:"";position:absolute;left:4px;top:13px;width:18px;height:18px;border:2px solid var(--green);border-radius:5px}
dl{margin:0}dt{font-weight:700;color:#fff;margin-top:14px}dd{margin:2px 0 0;color:var(--soft)}
table{width:100%;border-collapse:collapse;margin:10px 0}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid rgba(159,176,204,.25)}th{color:var(--green)}
.small{font-size:14px;color:var(--muted)}.btn{display:inline-block;margin:6px 8px 6px 0;padding:10px 16px;border-radius:12px;background:var(--green);color:var(--ink);font-weight:700;text-decoration:none}
a.g{display:block;text-decoration:none;color:inherit}a.g .card{transition:transform .15s}a.g:hover .card{transform:translateY(-2px)}
.kw{display:inline-block;background:var(--green);color:var(--ink);font-weight:800;border-radius:8px;padding:1px 8px;font-size:14px;margin-left:8px;vertical-align:middle}
@media print{body{background:#fff;color:#111}h1,h2,dt{color:#111}.card{background:#f3f5f9}.btn,.top a{display:none}ul.chk li{border-color:#ccc}}
"""
HEAD = """<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>%s · Tu Amigo de las Finanzas</title>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Hanken+Grotesk:wght@400;500;700&display=swap" rel="stylesheet"><style>%s</style></head><body><main>"""
FOOT = """<p class="small">Contenido informativo y educativo. No es asesoramiento financiero ni fiscal. Comprueba siempre los datos y plazos vigentes en las fuentes oficiales.</p>
<p class="small">@tuamigodelasfinanzas · <a href="./" style="color:#35D07F">Más guías</a></p></main></body></html>"""
def e(s): return html.escape(s)
def chk(items): return '<ul class="chk">'+''.join(f'<li>{e(i)}</li>' for i in items)+'</ul>'
def dl(items): return '<dl>'+''.join(f'<dt>{e(a)}</dt><dd>{e(b)}</dd>' for a,b in items)+'</dl>'
def table(h,rows): return '<table><tr>'+''.join(f'<th>{e(x)}</th>' for x in h)+'</tr>'+''.join('<tr>'+''.join(f'<td>{e(c)}</td>' for c in r)+'</tr>' for r in rows)+'</table>'
def card(x): return f'<div class="card">{x}</div>'
def sec(t,b): return f'<h2>{e(t)}</h2>{b}'
def page(slug,title,sub,body):
    h=HEAD%(e(title.replace('<em>','').replace('</em>','')),CSS)+f'<div class="top">@tuamigodelasfinanzas · <a href="./">Todas las guías</a> · <a href="javascript:window.print()">Imprimir o guardar en PDF</a></div><h1>{title}</h1><p class="lead">{e(sub)}</p>'+body+FOOT
    open(f'{slug}.html','w',encoding='utf-8').write(h)

page('ahorro','Presupuesto mensual <em>en 15 minutos</em>','Para saber a dónde se va tu dinero y decidir cuánto apartar, sin hojas de cálculo complicadas.',
 sec('Paso 1 · Apunta lo que entra',chk(['Sueldo neto del mes (lo que llega a tu cuenta)','Ingresos extra habituales (alquiler, pensiones, trabajos puntuales)','Pagas extra: si se prorratean, ya están dentro; si no, apúntalas en el mes en que llegan']))+
 sec('Paso 2 · Apunta lo que sale',table(['Tipo','Ejemplos','Cuánto al mes'],[['Fijos','Alquiler o hipoteca, luz, agua, internet, seguros','___ €'],['Variables necesarios','Compra, transporte, farmacia','___ €'],['Suscripciones','Streaming, apps, gimnasio','___ €'],['Ocio y caprichos','Restaurantes, ropa, viajes','___ €'],['Ahorro','Lo que apartas el día que cobras','___ €']]))+
 sec('Una referencia, no una regla: 50 / 30 / 20',card('<p>Mucha gente usa este reparto como punto de partida: <b>50 %</b> para necesidades, <b>30 %</b> para deseos y <b>20 %</b> para ahorro. Con un sueldo neto de 1.500 €, serían 750 €, 450 € y 300 €.</p><p class="small">Cada hogar es distinto. Si tus gastos fijos ya pasan del 50 %, ajusta los porcentajes a tu situación; lo importante es tener un reparto claro.</p>'))+
 sec('Paso 3 · Automatiza',chk(['Programa una transferencia a tu cuenta de ahorro el día que cobras','Separa el dinero del mes en dos cuentas: gastos y ahorro','Revisa el presupuesto el primer domingo de cada mes (10 minutos)','Si un mes te pasas, apúntalo y corrige el siguiente; no hace falta empezar de cero']))+
 sec('Tu colchón',card('<p>Una pauta habitual es reunir entre <b>3 y 6 meses</b> de gastos fijos para imprevistos. Empieza por un primer objetivo pequeño, por ejemplo un mes de gastos.</p>')))

page('renta','Checklist de la <em>declaración de la renta</em>','Lo que conviene tener a mano antes de abrir el borrador.',
 sec('Antes de empezar',chk(['Ten a mano tu DNI y el medio con el que te identificas en la Agencia Tributaria (Cl@ve, certificado digital)','Consulta en la web oficial las fechas de la campaña: suele ir de abril a finales de junio, pero cambia cada año','Revisa los datos fiscales que la Agencia ya tiene sobre ti (descárgalos desde su sede electrónica)']))+
 sec('Documentos habituales',chk(['Certificado de retenciones de tu empresa (si no aparece ya en tus datos fiscales)','Extractos o certificados de intereses de cuentas y depósitos','Información de fondos, acciones o criptomonedas vendidos durante el año','Recibos del alquiler (si eres inquilino) o datos de las propiedades que tengas','Justificantes de aportaciones a planes de pensiones','Datos de hijos y personas a tu cargo (fechas de nacimiento, convivencia)','Gastos con posible deducción estatal o autonómica (donativos, rehabilitación, etc.)']))+
 sec('Antes de enviarla',chk(['Revisa el borrador línea por línea; el borrador no es definitivo hasta que lo confirmas','Comprueba tu número de cuenta si te sale a pagar o a devolver','Guarda el justificante de presentación y un PDF de la declaración','Si tienes dudas con tu caso (varios pagadores, venta de inmuebles, extranjero), consulta con un asesor fiscal']))+
 sec('Glosario rápido',dl([('Base imponible','La parte de tus ingresos sobre la que se calcula el impuesto.'),('Retención','Lo que tu pagador ya adelanta a Hacienda en cada nómina.'),('Deducción','Una cantidad que reduce lo que pagas directamente.'),('Borrador','Propuesta de declaración que elabora la Agencia con tus datos.')])))

terms=[('Acción','Parte del capital de una empresa.'),('Bolsa','Mercado donde se compran y venden acciones y otros valores.'),('Índice','Cesta de valores que mide la evolución de un mercado (IBEX 35, S&P 500).'),('IBEX 35','Índice de las 35 mayores empresas de la bolsa española.'),('S&P 500','Índice de 500 grandes empresas de EE. UU.'),('Dividendo','Parte del beneficio que una empresa reparte a sus accionistas.'),('ETF','Fondo que cotiza en bolsa y suele replicar un índice.'),('Fondo de inversión','Vehículo que reúne el dinero de muchos inversores y lo gestiona.'),('Fondo indexado','Fondo que intenta replicar un índice.'),('Cartera','Conjunto de inversiones que tiene una persona.'),('Diversificar','Repartir el dinero entre distintos activos para no depender de uno.'),('Rentabilidad','Ganancia o pérdida de una inversión, normalmente en porcentaje.'),('Riesgo','Posibilidad de que el resultado sea distinto del esperado, incluida la pérdida.'),('Volatilidad','Cuánto sube y baja el precio de un activo.'),('Inflación','Subida general de precios; resta poder de compra al dinero.'),('Tipo de interés','Precio del dinero; lo fija el banco central y afecta a hipotecas y ahorro.'),('BCE','Banco Central Europeo, fija los tipos en la zona euro.'),('Fed','Banco central de EE. UU.'),('Bono','Deuda que emite un Estado o empresa y paga intereses.'),('Renta fija','Inversiones que pagan intereses acordados, como los bonos.'),('Renta variable','Inversiones cuyo resultado depende del mercado, como las acciones.'),('Mercado alcista','Periodo de subidas prolongadas.'),('Mercado bajista','Periodo de caídas prolongadas.'),('Capitalización','Valor total de una empresa en bolsa: precio por número de acciones.'),('PER','Precio de la acción entre el beneficio por acción.'),('Comisión','Coste por comprar, vender o mantener una inversión.'),('Broker','Intermediario a través del que compras y vendes valores.'),('Liquidez','Facilidad para convertir algo en dinero sin perder valor.'),('Interés compuesto','Intereses que generan nuevos intereses con el tiempo.'),('Horizonte temporal','Tiempo durante el que piensas mantener una inversión.')]
page('bolsa','Glosario de bolsa: <em>30 términos</em>','Para entender las noticias sin perderte con la jerga.',
 sec('De la A a la Z (más o menos)',dl(terms))+sec('Cómo usarlo',card('<p>Léelo una vez, y vuelve a él cuando una noticia use una palabra que no tengas clara. Si quieres más, cada semana publicamos una explicación en @tuamigodelasfinanzas.</p>')))

page('gastos','Revisión de <em>gastos fijos</em> y comisiones','Una tarde al año para detectar pagos que ya no necesitas.',
 sec('Suscripciones y servicios',chk(['Lista todas las suscripciones: streaming, música, apps, gimnasio, revistas','Marca las que no has usado en el último mes','Revisa si tienes servicios duplicados (dos plataformas de vídeo, dos seguros de móvil)','Pon en el calendario la fecha de renovación anual de las que mantienes']))+
 sec('Banco',chk(['Revisa las comisiones de mantenimiento, tarjetas y transferencias de tus cuentas','Comprueba si cumples las condiciones que eliminan las comisiones','Compara la TAE de tus cuentas y depósitos, no solo el TIN','Cancela tarjetas y cuentas que no usas']))+
 sec('Hogar y seguros',chk(['Compara tarifas de luz, gas, internet y móvil cada año','Revisa las coberturas de tus seguros y su precio al renovar','Mira si pagas por servicios añadidos que no necesitas']))+
 sec('TAE y TIN',card('<p>El <b>TIN</b> es el tipo de interés nominal, sin contar comisiones. La <b>TAE</b> incluye comisiones y la frecuencia de pago de intereses, y por eso sirve mejor para comparar productos.</p>'))+
 sec('Tu resumen',table(['Qué reviso','Cuánto pago al año','¿Lo mantengo?'],[['','___ €',''],['','___ €',''],['','___ €','']])))

idx=HEAD%('Guías gratis',CSS)+'<div class="top">@tuamigodelasfinanzas</div><h1>Guías <em>gratis</em></h1><p class="lead">Plantillas y listas para ahorrar mejor y entender tu dinero. Todo gratis, sin registro.</p>'
for slug,k,t,d in [('ahorro','AHORRO','Presupuesto mensual en 15 minutos','Plantilla paso a paso y reparto 50/30/20 como referencia.'),('renta','RENTA','Checklist de la declaración de la renta','Documentos y pasos antes de abrir el borrador.'),('bolsa','BOLSA','Glosario de bolsa: 30 términos','Para entender las noticias sin jerga.'),('gastos','GASTOS','Revisión de gastos fijos y comisiones','Suscripciones, banco, seguros, TAE y TIN.')]:
    idx+=f'<a class="g" href="{slug}.html"><div class="card"><h2 style="margin:0 0 4px;font-size:28px">{t}<span class="kw">{k}</span></h2><p style="margin:0">{d}</p></div></a>'
idx+=FOOT
open('index.html','w',encoding='utf-8').write(idx)
print('ok')
