#!/usr/bin/python
# -*- coding: utf-8 -*-



"""
by Pouye Yazdi
Topography and Cartography Department
Technical University of Madrid, Spain
November 2017

"""

import sys 
import datetime
import os.path 
import json 
from collections import OrderedDict
print ('***** Python version: ******\n'+sys.version+'\n--------------------\n')
print ('***** THIS CODE IS FOR CALCULATING RISK AND DAMAGE *****')
print ('*****************  POUYE.YAZDI@UPM.ES  *****************\n\nSTART\n--------------------') 
time=datetime.datetime.now()
from info import inputpath,outputpath,shapefilepath,grid_filename
from info import vs30_shapefile_filename,bedrock_vs30,distance_type,final_result_filename
from info import Cat_Fault,Vs30_Polygons
from DIST import Zone_Based_Distance,Find_R_Zones, Fault_Proj
from RISK import Find_Vs30, GMA_DAMAGE,NEHRP_Class 

def main(argv):
    print('Start time %s'%datetime.datetime.now()) 
#******************************************************************************
# DELETE EXISTING final_result_filename ***************************************
#    if  os.path.exists(os.path.join(outputpath,final_result_filename)):
#        os.remove(os.path.join(outputpath,final_result_filename))   
### if INPUT directory exists..................................................
    if not os.path.exists(inputpath):
        raise ValueError('input directory "%s" does not exist'%inputpath)
### if OUTPUT directory exists.................................................
    if not os.path.exists(outputpath):
       raise ValueError('output directory "%s" does not exist'%outputpath)
#### DEFINE GRID ······························································    
    if os.path.exists(os.path.join(inputpath,grid_filename))==False:
        raise ValueError('grid file "%s" does not exist'%grid_filename)
    else:
        print('OK! You are asking for:')
        print('Risk calculation on geographical coordinates inside "%s/%s"\n----------------------' %(inputpath,grid_filename))
        print(grid_filename)
    grid_file=open(os.path.join(inputpath,grid_filename),'r')
    grid_line=grid_file.readlines()
    size_of_grid=len(grid_line)
    grid_file.close()
    print('Total number of points: %d\n----------------------'%size_of_grid)
#### READ FAULT································································
    fault_dict=Cat_Fault(argv[1:])
    fault_proj_vertices=Fault_Proj(fault_dict)
#### READ SCENARIO·····························································
    probability_scenario=int(argv[0])
    if probability_scenario==0:
        scenario='High Probability'
        col_damage=7
    elif probability_scenario==1:
        scenario='Low Probability'
        col_damage=7
    elif probability_scenario==2:
        scenario='Very Low Probability'
        col_damage=8
    print('A "%s" scenario is asked for risk calculation\n----------------------'%scenario)
### if SHAPEFILE directory exist  .............................................         
    if os.path.exists(shapefilepath):
        vs30_list=Vs30_Polygons(vs30_shapefile_filename)
        if not vs30_list:
            print('WARNING: No Vs30 was found')
            print('WARNING: No soil effect will be considered or Vs30=800\n----------------------')
            vs30=bedrock_vs30 
    else:
        print('WARNING: The directory "%s" was not found'%shapefilepath)
        print('WARNING: Vs30 shapefile can not be localized')
        print('WARNING: No soil effect will be considered or Vs30=800\n----------------------')
        vs30_list=[]
        vs30=bedrock_vs30
#******************************************************************************
#..............................................................................
##.............................................................................
#### CALCULATE R·······························································
    print('The attenuation relation we applied in this programm is Akkar et al.(2014).\n')
    print('Thus, the distance type we need to be calculated is: %s\n'%distance_type)
    with open(os.path.join(outputpath,final_result_filename),'w') as w: 
        w.writelines('var excelData = [')
### gridline contains: uid long lat REFCAT H_MAX YEAR VUL_CODE FACADE_L    
        for line in grid_line:
            uid=int(line.split()[0])
            latlong=(round(float(line.split()[2]),5),round(float(line.split()[1]),5))
            zone=Find_R_Zones(latlong,fault_proj_vertices,fault_dict.get('azimuth'),distance_type)       
            distance=Zone_Based_Distance(latlong,zone,fault_proj_vertices,fault_dict,distance_type)
            if vs30_list:
                vs30=Find_Vs30(latlong,vs30_list)
            soil_type=NEHRP_Class(vs30)
            vul_code=line.split()[6]
            params=[uid,distance,vs30,vul_code]
#### CALCULATE RHAZARD AND DAMAGE··············································
            gma_and_damage_array=GMA_DAMAGE(params,fault_dict.get('magnitude'),fault_dict.get('mechanism'),probability_scenario)
###         gma_and_damage_array contains: ['PGA','SA_te','P(nul)','P(low)','P(mod)','P(ext)','P(com)','D(medio)','D(85%)','V_Debris']
            dato=OrderedDict([('UID',uid),\
                  ('REFCAT',line.split()[3]),\
                  ('Vulnerabilidad',vul_code[:-2]),\
                  ("SA' ",round(float(gma_and_damage_array[1]),3)),\
                  ('GradoDanio',gma_and_damage_array[col_damage]),\
                  ('PGA',round(float(gma_and_damage_array[0]),3)),\
                  ('Suelo',soil_type),\
                  ('pNull',round(float(gma_and_damage_array[2]),3)),\
                  ('pLow',round(float(gma_and_damage_array[3]),3)),\
                  ('pMod',round(float(gma_and_damage_array[4]),3)),\
                  ('pExt',round(float(gma_and_damage_array[5]),3)),\
                  ('pCom',round(float(gma_and_damage_array[6]),3)),\
                  ('pMean',gma_and_damage_array[7]),\
                  ('ojo',gma_and_damage_array[9]),\
                  ('year',int(line.split()[5])),\
                  ('floor',int(line.split()[4])),\
                  ('facadeL',round(float(line.split()[7]),2)),\
                  ('Escombro','-')])
            w.writelines('\n')
            json.dump(dato,w)
            w.writelines(',')            
        w.writelines('\n{"UID": -1}]')
        w.write('\nvar maxDebrisVolUnit = %4.1f'%1.0)
        w.close()
    print('Elapsed time without debris estimations: %s'%(datetime.datetime.now()-time)) 


if __name__=='__main__':
    user_source=sys.argv[1:]
    if not len(user_source)>=10:
        print('Please check the given source values: they must be at least 10'\
              +'and ordered as'\
              +' below:\nProbabilityScenario lat(geographic) long(geographic)'\
              +' Magnitude Strike(0-360) Dip(0-90) FocalMechanism Length(km)'\
              +' Ztor(km) Width(km)')
        print('Your input values are %s'%user_source)
        sys.exit(1)
    main(user_source)
        

        
