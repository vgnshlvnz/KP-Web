/**
 * Cloudflare Worker Entrypoint for KP-Web.
 *
 * Exposes REST API endpoints for:
 *   - /api/calculate (natal / event chart)
 *   - /api/horary (KP horary 1–249 chart)
 *   - /api/horary-table (standard 1–249 table)
 *   - /api/ayanamsa (KP Old & KP New ayanamsa values)
 *   - /api/health (service health & engine status)
 */

import { AyanamsaMode, DateTimeInput, NodeMode } from './types.js';
import { calculateKpAyanamsa, dateToJulianDay, formatDms } from './ephemeris/ayanamsa.js';
import { calculateNatalChart } from './kp/engine.js';
import { calculateHoraryChart } from './kp/horary.js';
import { getHoraryEntry, getHoraryTable } from './kp/horary-table.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. Health check & Engine info
      if (path === '/' || path === '/api/health') {
        return jsonResponse({
          status: 'ok',
          service: 'KP-Web Astrology Engine',
          version: '0.1.0',
          engine: 'NASA JPL Ephemeris (DE405/VSOP87/NOVAS via astronomy-engine)',
          ayanamsas: ['KP_OLD (SE_SIDM_KRISHNAMURTI)', 'KP_NEW (SE_SIDM_KRISHNAMURTI_VP291)'],
          houseSystem: 'Placidus',
          licensing: 'NASA Public Domain / Permissive Open Source (Zero AGPL obligations)',
          runtime: 'Cloudflare Workers (Wrangler compatible)',
          endpoints: [
            'GET  /api/health',
            'POST /api/calculate',
            'POST /api/horary',
            'GET  /api/horary-table',
            'GET  /api/ayanamsa',
          ],
        });
      }

      // 2. Ayanamsa endpoint
      if (path === '/api/ayanamsa' && request.method === 'GET') {
        const dateParam = url.searchParams.get('date');
        let date = new Date();
        if (dateParam) {
          const parsed = new Date(dateParam);
          if (isNaN(parsed.getTime())) {
            return errorResponse('Invalid date parameter. Use ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ.');
          }
          date = parsed;
        }

        const jd = dateToJulianDay(
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          date.getUTCDate(),
          date.getUTCHours(),
          date.getUTCMinutes(),
          date.getUTCSeconds()
        );

        const kpOld = calculateKpAyanamsa(jd, 'KP_OLD');
        const kpNew = calculateKpAyanamsa(jd, 'KP_NEW');

        return jsonResponse({
          dateUtc: date.toISOString(),
          julianDay: jd,
          kpOld: {
            degrees: kpOld,
            dms: formatDms(kpOld, true),
            id: 'SE_SIDM_KRISHNAMURTI',
          },
          kpNew: {
            degrees: kpNew,
            dms: formatDms(kpNew, true),
            id: 'SE_SIDM_KRISHNAMURTI_VP291',
          },
          differenceArcsec: (kpNew - kpOld) * 3600,
        });
      }

      // 3. Horary Table endpoint (1-249)
      if (path === '/api/horary-table' && request.method === 'GET') {
        const numParam = url.searchParams.get('number');
        if (numParam) {
          const num = parseInt(numParam, 10);
          if (isNaN(num) || num < 1 || num > 249) {
            return errorResponse('Horary number must be an integer between 1 and 249.');
          }
          return jsonResponse(getHoraryEntry(num));
        }
        return jsonResponse(getHoraryTable());
      }

      // 4. Calculate Natal / Event Chart
      if (path === '/api/calculate' && request.method === 'POST') {
        let body: {
          dateTime?: DateTimeInput;
          coordinates?: { latitude: number; longitude: number };
          ayanamsaMode?: AyanamsaMode;
          nodeMode?: NodeMode;
        };

        try {
          body = await request.json();
        } catch {
          return errorResponse('Invalid JSON body.');
        }

        if (!body.dateTime || !body.coordinates) {
          return errorResponse(
            'Missing required fields. Request body must include "dateTime" and "coordinates".'
          );
        }

        const result = calculateNatalChart({
          dateTime: body.dateTime,
          coordinates: body.coordinates,
          ayanamsaMode: body.ayanamsaMode || 'KP_OLD',
          nodeMode: body.nodeMode || 'MEAN',
        });

        return jsonResponse(result);
      }

      // 5. Calculate Horary Chart (1-249)
      if (path === '/api/horary' && request.method === 'POST') {
        let body: {
          horaryNumber?: number;
          dateUtc?: string;
          coordinates?: { latitude: number; longitude: number };
          ayanamsaMode?: AyanamsaMode;
          useSubMidpoint?: boolean;
          nodeMode?: NodeMode;
        };

        try {
          body = await request.json();
        } catch {
          return errorResponse('Invalid JSON body.');
        }

        if (
          body.horaryNumber === undefined ||
          body.horaryNumber < 1 ||
          body.horaryNumber > 249 ||
          !body.coordinates
        ) {
          return errorResponse(
            'Missing or invalid fields. "horaryNumber" (1-249) and "coordinates" are required.'
          );
        }

        let dateUtc = new Date();
        if (body.dateUtc) {
          const parsed = new Date(body.dateUtc);
          if (isNaN(parsed.getTime())) {
            return errorResponse('Invalid "dateUtc" format.');
          }
          dateUtc = parsed;
        }

        const result = calculateHoraryChart({
          horaryNumber: body.horaryNumber,
          dateUtc,
          coordinates: body.coordinates,
          ayanamsaMode: body.ayanamsaMode || 'KP_OLD',
          useSubMidpoint: body.useSubMidpoint || false,
          nodeMode: body.nodeMode || 'MEAN',
        });

        return jsonResponse(result);
      }

      return errorResponse(`Route not found: ${path}`, 404);
    } catch (err: unknown) {
      console.error('Calculation error:', err);
      return errorResponse('An internal error occurred while processing the request.', 500);
    }
  },
};
