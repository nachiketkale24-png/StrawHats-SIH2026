import React from 'react'
import { ScrollView, View, Text, Switch, TouchableOpacity } from 'react-native'
import { useTheme } from '../theme/ThemeProvider'
import type { DrainageResponse } from '../api/floodApi'
interface Props {
  mapType: 'standard'|'satellite'; onToggleMapType:()=>void
  floodVisible:boolean; onFlood:(value:boolean)=>void; traffic:boolean; onTraffic:(value:boolean)=>void
  roadsVisible:boolean; onRoads:(value:boolean)=>void; drainage:DrainageResponse|null; drainageError:string
  drainageMode:'summary'|'affected'|'full'; onDrainageMode:(value:'summary'|'affected'|'full')=>void
}
export function LegendSheet(props:Props) {
  const { colors }=useTheme()
  const row=(label:string,value:boolean,onChange:(value:boolean)=>void)=><View key={label} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginVertical:6}}><Text style={{color:colors.textPrimary,fontSize:14}}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{true:colors.gold}} /></View>
  const summary=props.drainage?.summary
  return <ScrollView contentContainerStyle={{padding:18,paddingBottom:40}}>
    <Text style={{color:colors.textHeading,fontSize:17,fontWeight:'600',marginBottom:10}}>Map layers</Text>
    {row('Flood susceptibility',props.floodVisible,props.onFlood)}
    {row('Road risk (zoom in)',props.roadsVisible,props.onRoads)}
    {row('Current traffic',props.traffic,props.onTraffic)}
    {row('Satellite',props.mapType==='satellite',props.onToggleMapType)}
    <Text style={{color:colors.textSecondary,fontSize:12,marginVertical:12}}>Traffic is live display data. Flood routes use the selected rainfall event and window.</Text>
    <Text style={{color:colors.textHeading,fontSize:17,fontWeight:'600',marginTop:16,marginBottom:12}}>Flood susceptibility index</Text>
    {['Low','Medium','High','Severe'].map((label,i)=><View key={label} style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10}}><View style={{width:14,height:14,borderRadius:4,backgroundColor:['#38bdf8','#facc15','#fb923c','#ef4444'][i]}}/><Text style={{flex:1,color:colors.textPrimary}}>{label} risk</Text><Text style={{color:colors.textSecondary}}>{(i/4).toFixed(2)} – {((i+1)/4).toFixed(2)}</Text></View>)}
    <Text style={{color:colors.textSecondary,fontSize:12,lineHeight:19}}>Risk shading is shown over land. Open water is unshaded. Areas beyond data coverage are unassessed.</Text>
    <Text style={{color:colors.textHeading,fontSize:17,fontWeight:'600',marginTop:22,marginBottom:12}}>Drainage network</Text>
    <Text style={{color:colors.textSecondary,lineHeight:22}}>{props.drainageError ? `Drainage unavailable: ${props.drainageError}` : summary ? `${summary.surcharged_manholes.toLocaleString()} of ${summary.total_manholes.toLocaleString()} manholes surcharged\n${summary.surcharged_conduits.toLocaleString()} of ${summary.total_conduits.toLocaleString()} conduits surcharged` : 'Loading drainage…'}</Text>
    {(['summary','affected','full'] as const).map(value=><TouchableOpacity key={value} onPress={()=>props.onDrainageMode(value)} style={{flexDirection:'row',gap:10,paddingVertical:12}}><Text style={{color:colors.gold}}>{props.drainageMode===value?'●':'○'}</Text><Text style={{color:colors.textPrimary}}>{value==='summary'?'Hide drainage points':value==='affected'?'Show affected drainage (yellow/red)':'Show full network (zoom in)'}</Text></TouchableOpacity>)}
    <Text style={{color:colors.textSecondary,fontSize:12,lineHeight:19}}>Green: normal · Yellow: above 50% capacity · Red: surcharged. Full network points appear at zoom 13; conduits at zoom 15.</Text>
  </ScrollView>
}
