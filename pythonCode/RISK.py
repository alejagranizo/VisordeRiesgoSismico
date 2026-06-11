#!/usr/bin/python
# -*- coding: utf-8 -*-
"""
by Alejandra Granizo and Pouye Yazdi
Topography and Cartography Department
Technical University of Madrid, Spain
November 2017

Optimised 2026: GMM results cached by (r_bin, vs30) to avoid redundant
pygmm calls for buildings at similar distances and soil conditions.
"""

from shapely.geometry import Point
import pygmm
from info import default_te, bedrock_vs30, parameters_excelfilename
from info import vul_table, debris_table_M, debris_table_H
from math import pi, sqrt, log
import numpy as np
import sys
from scipy.interpolate import interp1d
from scipy.stats import norm

MAX_DIST_KM = 200   # Límite máximo del modelo Akkar-Sandikkaya-Bommer 2014

# ── Caché de resultados GMM ───────────────────────────────────────────────────
# Clave: (r_bin, vs30_clamped, mag, mechanism, scenario)
# r_bin = round(r, 2)  →  resolución 10 m, suficiente para ingeniería sísmica
# Valor: dict con pga, spec_accels, periods, ln_stds, ln_std_pga
_gmm_cache = {}

def _clear_gmm_cache():
    """Llamar entre terremotos distintos si el proceso Python se reutiliza."""
    _gmm_cache.clear()

def _get_gmm(r, vs30_clamped, mag, mechanism, scenario):
    """
    Devuelve (pga, interpol_func) usando caché.
    interpol_func(te) → sa_te en g
    """
    r_bin = round(r, 2)          # resolución 10 m
    key   = (r_bin, vs30_clamped, mag, mechanism, scenario)

    if key not in _gmm_cache:
        s = pygmm.model.Scenario(dist_jb=r_bin, mag=mag,
                                 mechanism=mechanism, v_s30=vs30_clamped)
        m = pygmm.AkkarSandikkayaBommer2014(s)
        if scenario == 0:
            accels = m.spec_accels
            pga    = m.pga
        else:
            accels = np.exp(np.log(m.spec_accels) + m.ln_stds)
            pga    = np.exp(np.log(m.pga) + m.ln_std_pga)
        _gmm_cache[key] = {
            'pga':     pga,
            'periods': m.periods,
            'accels':  accels,
        }

    entry  = _gmm_cache[key]
    interpol = interp1d(entry['periods'], entry['accels'])
    return entry['pga'], interpol


def Find_Vs30(gridPoint, vs30PolygonList):
    point = Point(gridPoint[1], gridPoint[0])
    vs30  = bedrock_vs30
    for poly in vs30PolygonList:
        if poly[0].contains(point):
            vs30 = poly[1]
            break          # ← sale en cuanto encuentra el polígono correcto
    return vs30


def NEHRP_Class(Vs30Value):
    if Vs30Value   <= 180:  return 'E'
    elif Vs30Value <= 360:  return 'D'
    elif Vs30Value <= 760:  return 'C'
    elif Vs30Value <= 1500: return 'B'
    else:                   return 'A'


def GMA_DAMAGE(params, faultMagnitude, faultMechanism, scenario):
    note     = ''
    vul_code = params[3]
    uid      = int(params[0])
    r        = float(params[1])
    vs30     = int(params[2])

    if r > MAX_DIST_KM:
        msg = (
            f"DISTANCE_ERROR: The fault is too far from the study zone, with a distance of  "
            f"Rjb={r:.1f} km. "
            f"The seismic model (Akkar-Sandikkaya-Bommer 2014) is only valid for distances up to "
            f"{MAX_DIST_KM} km. "
            f"Please select a closer fault."
        )
        print(msg, file=sys.stderr)
        sys.exit(1)

    if vs30 > 1200:
        vs30 = 1200

    if vul_code in vul_table:
        dict_par = vul_table[vul_code]
        te = 2 * pi * sqrt((0.01 * float(dict_par['Dy'])) /
                           (float(dict_par['ay']) * 9.81))
        note = "Masonry" if vul_code[0] == "M" else "Reinforced Concrete"
    else:
        te   = default_te
        note = 'unknown(Te_default:0.3s)'

    # ── GMM: usar caché ───────────────────────────────────────────────────────
    pga, interpol = _get_gmm(r, vs30, faultMagnitude, faultMechanism, scenario)

    sa_te     = interpol(te)
    sa_te_gal = float(sa_te) * 9.81 * 100   # gal (cm/s²)

    if vul_code in vul_table:
        p = vul_table[vul_code]
        ay           = p['ay'] * 9.81 * 100
        sd_low       = p['sd_lev'];    sigma_sd_low = p['sigma_sd_lev']
        sd_mod       = p['sd_mod'];    sigma_sd_mod = p['sigma_sd_mod']
        sd_ext       = p['sd_ex'];     sigma_sd_ext = p['sigma_sd_ex']
        sd_com       = p['sd_com'];    sigma_sd_com = p['sigma_sd_com']

        eff_disp = Effective_Displacement(vs30, te,
                                          max(sa_te_gal, 0.001), ay)

        p_com = norm.cdf((1/sigma_sd_com) * log(eff_disp/sd_com))
        p_ext = norm.cdf((1/sigma_sd_ext) * log(eff_disp/sd_ext)) - p_com
        p_mod = norm.cdf((1/sigma_sd_mod) * log(eff_disp/sd_mod)) - p_com - p_ext
        p_low = norm.cdf((1/sigma_sd_low) * log(eff_disp/sd_low)) - p_com - p_ext - p_mod
        p_nul = 1 - p_com - p_ext - p_mod - p_low

        cum = p_nul
        if   cum >= 0.85:                 damage_ee = 'None'
        elif (cum := cum + p_low) >= 0.85: damage_ee = 'Sligth'
        elif (cum := cum + p_mod) >= 0.85: damage_ee = 'Moderate'
        elif (cum := cum + p_ext) >= 0.85: damage_ee = 'Extensive'
        else:                              damage_ee = 'Complete'

        idx = 1*p_low + 2*p_mod + 3*p_ext + 4*p_com
        if   idx <= 0.5: damage_medio = 'None'
        elif idx <= 1.5: damage_medio = 'Sligth'
        elif idx <= 2.5: damage_medio = 'Moderate'
        elif idx <= 3.5: damage_medio = 'Extensive'
        elif idx <= 4.0: damage_medio = 'Complete'
        else:            damage_medio = 'none'

        gma_damage_array = [pga, sa_te, p_nul, p_low, p_mod, p_ext, p_com,
                            damage_medio, damage_ee, note]
    else:
        print(f'ID={uid} : Vulnerability code "{vul_code}" does not exist in '
              f'vulnerability table inside excel file "{parameters_excelfilename}"')
        gma_damage_array = [pga, sa_te, -1, -1, -1, -1, -1, 'unknown', 'unknown', note]

    return gma_damage_array


def Effective_Displacement(Vs30_Value, naturalPeriod, saNaturalPeriod, Ay):
    soil_type = NEHRP_Class(Vs30_Value)
    if   soil_type in ('A', 'B'): a = 130
    elif soil_type == 'C':        a = 90
    elif soil_type in ('D', 'E'): a = 60
    else:
        raise ValueError(f'Soil type "{soil_type}" not defined')
    C1    = 1 + (saNaturalPeriod - Ay) / (a * Ay * naturalPeriod**2)
    C2    = 1 + (saNaturalPeriod - Ay)**2 / (800 * Ay**2 * naturalPeriod**2)
    delta = C1 * C2 * (saNaturalPeriod * (naturalPeriod / (2*pi))**2)
    return delta


def Debris_M(damage_degree, facade_length, floors):
    p          = debris_table_M[damage_degree]
    n_windows  = round(facade_length / 2.5, 0)
    per_floor  = [n_windows * p['V_Es_un'] * p['n_gr_w_p1']]
    if floors > 1 and damage_degree > 1:
        per_floor.append(n_windows * p['V_Es_un'] * p['n_gr_w_p2'])
        if floors > 2:
            per_floor.append(n_windows * p['V_Es_un'] * p['n_gr_w_p3'])
            if floors > 3:
                factor = 5 if damage_degree == 3 else 3
                for _ in range(4, floors + 1):
                    per_floor.append(per_floor[-1] / factor)
    cracks = (sum(per_floor)
              + p['n_gr_base']     * (facade_length/10) * p['V_Es_un']
              + p['n_gr_cubierta'] * (facade_length/10) * p['V_Es_un'])
    falling = (floors * 3 * facade_length *
               (p['frac_sup_fa_af']/100) * p['V_Es_un_el_ca_fa']
               if damage_degree > 2 else 0)
    return round(cracks + falling, 5)


def Debris_H(damage_degree, facade_length, floors):
    p         = debris_table_H[damage_degree]
    n_windows = round(facade_length / 5.0, 0)
    per_floor = [n_windows * p['V_Es_un'] * p['n_gr_w_p1']]
    if floors > 1 and damage_degree > 1:
        per_floor.append(n_windows * p['V_Es_un'] * p['n_gr_w_p2'])
        if floors > 2:
            per_floor.append(n_windows * p['V_Es_un'] * p['n_gr_w_p3'])
            if floors > 3:
                factor = 5 if damage_degree == 3 else 3
                for _ in range(4, floors + 1):
                    per_floor.append(per_floor[-1] / factor)
    cracks = (sum(per_floor)
              + p['n_gr_base']     * (facade_length/10) * p['V_Es_un']
              + p['n_gr_cubierta'] * (facade_length/10) * p['V_Es_un'])
    if damage_degree > 2:
        falling = (floors * 3 * facade_length *
                   (p['frac_sup_fa_af']/100) * p['V_Es_un_el_ca_fa']
                   + (facade_length * p['frac_sup_pet_af']/100) * p['V_Es_un_el_ca_pet'])
    else:
        falling = 0
    return round(cracks + falling, 5)


damage_level = {'None': 0, 'Sligth': 1, 'Moderate': 2, 'Extensive': 3, 'Complete': 4}


def Debris(facade_Len, bldg_id, damage, vulnerability, n_floors):
    damage_per_m2 = 0
    if facade_Len > 0.1 and damage not in ('unknown', 'None') and n_floors != 0:
        building_type = vulnerability[0]
        damage_l      = damage_level[damage]
        if   building_type == 'M': debrisVol = Debris_M(damage_l, facade_Len, n_floors)
        elif building_type == 'R': debrisVol = Debris_H(damage_l, facade_Len, n_floors)
        else:
            print(f'No building type starts with "{building_type}" (building ID: {bldg_id})')
            return -1
        damage_per_m2 = debrisVol / (facade_Len * damage_l)
    if damage == 'unknown':
        damage_per_m2 = -1
    return damage_per_m2