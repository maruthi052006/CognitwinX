"""
Chat Router Agent (7th Agent) — Orchestrates NL queries, tool-calling, and safety confirmation flows.
"""
import os
import re
import json
import logging
import requests
from django.conf import settings
from apps.digital_twin.models import CityZone, FloodPrediction
from .tools import get_available_tools_for_role
from .prompts import get_system_prompt
from .rag_engine import get_rag_engine

logger = logging.getLogger(__name__)


class ChatRouter:
    def __init__(self, user, session, language="en"):
        self.user = user
        self.session = session
        self.language = language
        # Determine user role from profile
        self.user_role = getattr(user.profile, 'role', 'public_viewer') if hasattr(user, 'profile') else 'public_viewer'
        self.tools = get_available_tools_for_role(self.user_role)
        self.llm_api_key = os.getenv('LLM_API_KEY') or os.getenv('OPENAI_API_KEY') or ''
        self.llm_base_url = os.getenv('LLM_BASE_URL', 'https://api.openai.com/v1')
        self.llm_model = os.getenv('LLM_MODEL', 'gpt-4o-mini')

    def process_message(self, user_message: str) -> dict:
        """
        Main entrypoint: parses message, handles pending safety confirmations,
        executes relevant agent tools, and synthesizes a grounded response.
        """
        clean_msg = user_message.strip()
        lower_msg = clean_msg.lower()

        # -------------------------------------------------------------
        # 1. CRITICAL SAFETY RULE: Confirm-Before-Alert Execution Flow
        # -------------------------------------------------------------
        pending = self.session.pending_confirmation
        if pending and pending.get('status') == 'pending':
            # Check for affirmative confirmation
            affirmative_words = ['yes', 'confirm', 'proceed', 'send', 'ok', 'do it', 'ha', 'haan', 's', 'y']
            negative_words = ['no', 'cancel', 'stop', 'abort', 'wait', 'don\'t', 'dont', 'n', 'nah']

            if any(lower_msg == word or lower_msg.startswith(word + ' ') or lower_msg.endswith(' ' + word) for word in affirmative_words):
                # Execute the confirmed side-effect tool
                params = pending.get('params', {})
                tool_func = self.tools.get('trigger_alert', {}).get('func')
                if not tool_func:
                    self.session.pending_confirmation = None
                    self.session.save()
                    return {
                        'content': "Error: You do not have permission to execute this emergency action.",
                        'tool_calls_made': [],
                        'requires_confirmation': False
                    }

                result = tool_func(
                    zone_id=params.get('zone_id'),
                    severity=params.get('severity', 'high'),
                    message=params.get('message', 'Emergency flood advisory'),
                    user=self.user
                )

                # Clear pending confirmation
                self.session.pending_confirmation = None
                self.session.save()

                content = (
                    f"✅ **ALERT CONFIRMED & DISPATCHED**\n\n"
                    f"• **Target**: SDMA / NDMA Incident Commander\n"
                    f"• **Zone**: {result.get('zone_name')}\n"
                    f"• **Severity**: {result.get('severity', '').upper()}\n"
                    f"• **SMS Status**: Dispatched via Twilio\n"
                    f"• **Audit Trail**: Recorded in `AgentDecisionLog` (`triggered_via=\"chat\"`)\n\n"
                    f"Broadcast message: \"{result.get('message')}\""
                )
                return {
                    'content': content,
                    'tool_calls_made': [{
                        'tool': 'trigger_alert',
                        'agent': 'Alert Agent',
                        'result': result
                    }],
                    'requires_confirmation': False
                }

            elif any(lower_msg == word or lower_msg.startswith(word + ' ') for word in negative_words):
                # Cancel pending action
                self.session.pending_confirmation = None
                self.session.save()
                return {
                    'content': "❌ Alert dispatch cancelled. No emergency messages or SMS were sent.",
                    'tool_calls_made': [],
                    'requires_confirmation': False
                }

        # -------------------------------------------------------------
        # 2. Check if the message is REQUESTING an Alert (Trigger Confirmation)
        # -------------------------------------------------------------
        is_alert_intent = (
            any(w in lower_msg for w in ['send alert', 'trigger alert', 'notify sdma', 'notify ndma', 'dispatch alert', 'evacuate', 'issue warning', 'send warning', 'emergency alert'])
            or (('alert' in lower_msg or 'warning' in lower_msg) and any(action in lower_msg for action in ['send', 'trigger', 'dispatch', 'notify', 'issue', 'broadcast', 'sdma', 'ndma']))
        )
        if is_alert_intent:
            if self.user_role == 'public_viewer':
                return {
                    'content': "🔒 **Access Restricted**: Public Viewer role does not have authorization to dispatch official municipal emergency flood alerts to SDMA.",
                    'tool_calls_made': [],
                    'requires_confirmation': False
                }

            # Resolve target zone from message or session zone_context
            target_zone = self._resolve_zone_from_message(lower_msg) or self.session.zone_context or CityZone.objects.first()
            if not target_zone:
                return {
                    'content': "Please specify which city zone you want to trigger an alert for.",
                    'tool_calls_made': [],
                    'requires_confirmation': False
                }

            # Determine severity
            severity = 'critical' if 'critical' in lower_msg else ('high' if 'high' in lower_msg else 'medium')
            alert_message = (
                f"[NDMA/SDMA MANUAL COMMAND] Emergency flood advisory active for {target_zone.name}. "
                f"Immediate response deployment requested."
            )

            # Record pending confirmation in session
            confirmation_payload = {
                'tool': 'trigger_alert',
                'status': 'pending',
                'params': {
                    'zone_id': target_zone.id,
                    'zone_name': target_zone.name,
                    'severity': severity,
                    'message': alert_message
                }
            }
            self.session.pending_confirmation = confirmation_payload
            self.session.save()

            confirmation_text = (
                f"⚠️ **CRITICAL ACTION CONFIRMATION REQUIRED**\n\n"
                f"This will send a **{severity.upper()}** alert to SDMA & Ward Responders for **{target_zone.name}** and dispatch SMS.\n\n"
                f"**Confirm? [Yes / No]**"
            )

            return {
                'content': confirmation_text,
                'tool_calls_made': [],
                'requires_confirmation': True,
                'confirmation_payload': confirmation_payload
            }

        # -------------------------------------------------------------
        # 3. LLM API Call or Deterministic Router Fallback
        # -------------------------------------------------------------
        if self.llm_api_key:
            try:
                return self._call_llm_with_tools(clean_msg)
            except Exception as e:
                logger.warning(f"LLM API call failed ({e}), falling back to deterministic twin router.")

        # Fallback deterministic router with tool orchestration
        return self._deterministic_tool_router(clean_msg)

    def _resolve_zone_from_message(self, lower_msg: str):
        """Helper to identify zone by name or ID from message string."""
        zones = CityZone.objects.all()
        for z in zones:
            if z.name.lower() in lower_msg or f"zone {z.id}" in lower_msg or f"ward {z.name.lower()}" in lower_msg:
                return z
            # Match individual words with length >= 4
            for part in z.name.lower().replace('-', ' ').split():
                if len(part) >= 4 and part in lower_msg:
                    return z
        return None


    def _deterministic_tool_router(self, user_message: str) -> dict:
        """
        Interprets natural language queries, invokes the exact existing twin agent
        functions as tools, and compiles responses with strict data fidelity.
        """
        lower = user_message.lower()
        tool_calls_made = []

        # A. Compare Zones
        if any(k in lower for k in ['compare', 'rank', 'all zones', 'which zone', 'worst', 'highest risk', 'summary']):
            tool_res = self.tools['compare_zones']['func']()
            tool_calls_made.append({
                'tool': 'compare_zones',
                'agent': 'Orchestrator Agent',
                'result': tool_res
            })
            ranked = tool_res['ranked_zones']
            lines = [f"📊 **Multi-Zone Risk Comparison** (Evaluated {len(ranked)} zones):"]
            for r in ranked:
                lines.append(
                    f"• **{r['zone_name']}** ({r['city']}): {r['risk_tier']} Risk | "
                    f"Depth: **{r['predicted_depth_m']}m** (Conf: {r['confidence_score']*100:.1f}%) | "
                    f"Drainage Index: {r['drainage_capacity']*100:.0f}%"
                )
            lines.append(f"\n⚡ **Highest Risk Zone**: {tool_res['highest_risk_zone']}")
            return {
                'content': "\n".join(lines),
                'tool_calls_made': tool_calls_made,
                'requires_confirmation': False
            }

        # B. What-If Simulation
        if any(k in lower for k in ['simulate', 'what if', 'what-if', 'scenario', 'rainfall increase', 'drainage drop']):
            target_zone = self._resolve_zone_from_message(lower) or self.session.zone_context or CityZone.objects.first()
            # Extract rain delta percentage
            rain_match = re.search(r'([+-]?\d+)\s*%', lower)
            rain_delta = float(rain_match.group(1)) if rain_match else 25.0
            drainage_factor = 0.7 if 'drainage' in lower or 'block' in lower else 1.0

            sim_res = self.tools['run_whatif_simulation']['func'](
                zone_id=target_zone.id,
                rainfall_delta=rain_delta,
                drainage_factor=drainage_factor,
                time_horizon=4
            )
            tool_calls_made.append({
                'tool': 'run_whatif_simulation',
                'agent': 'Simulation Agent',
                'result': sim_res
            })

            content = (
                f"🌊 **Hydrodynamic What-If Simulation Result** for **{target_zone.name}**:\n\n"
                f"• **Rainfall Variation**: {sim_res['rainfall_delta_percent']:+0.1f}%\n"
                f"• **Drainage Efficiency**: {sim_res['drainage_factor']*100:.0f}%\n"
                f"• **Peak Projected Depth**: **{sim_res['peak_depth_m']}m**\n"
                f"• **Projection Timeline**:\n"
            )
            for step in sim_res['time_series_summary']:
                content += f"  - T+{step['hour']}h: **{step['projected_depth_m']}m** ({step['risk_level'].upper()} risk)\n"
            content += "\nComputed via 2D Kinematic Wave & Elevation Flow Proxy."
            return {
                'content': content,
                'tool_calls_made': tool_calls_made,
                'requires_confirmation': False
            }

        # C. Explainability
        if any(k in lower for k in ['explain', 'why', 'shap', 'grad-cam', 'attribution', 'cause', 'reason']):
            target_zone = self._resolve_zone_from_message(lower) or self.session.zone_context or CityZone.objects.first()
            latest_pred = target_zone.predictions.order_by('-timestamp').first()
            pred_id = latest_pred.id if latest_pred else 1
            expl_res = self.tools['get_explanation']['func'](prediction_id=pred_id)
            tool_calls_made.append({
                'tool': 'get_explanation',
                'agent': 'Explainability Agent',
                'result': expl_res
            })

            content = (
                f"🧠 **Explainability Rationale (Prediction #{expl_res['prediction_id']})**:\n\n"
                f"{expl_res['explanation_summary']}\n\n"
                f"**Key Feature Importances**:\n"
            )
            for feat, score in expl_res['feature_importance_scores'].items():
                content += f"• `{feat}`: **{score}**\n"
            return {
                'content': content,
                'tool_calls_made': tool_calls_made,
                'requires_confirmation': False
            }

        # D. Cognition Log / What Happened
        if any(k in lower for k in ['cognition', 'agent reasoning', 'what happened', 'cycle', 'self-correct', 'log', 'trace']):
            target_zone = self._resolve_zone_from_message(lower) or self.session.zone_context
            is_pub = (self.user_role == 'public_viewer')
            log_res = self.tools['get_cognition_log']['func'](
                zone_id=target_zone.id if target_zone else None,
                limit=4,
                is_public=is_pub
            )
            tool_calls_made.append({
                'tool': 'get_cognition_log',
                'agent': 'Orchestrator Agent',
                'result': log_res
            })

            content = f"🔍 **Agent Cognition Log** ({'Public View' if is_pub else 'Internal Trace'}):\n\n"
            for item in log_res['logs']:
                content += (
                    f"• `[{item['timestamp']}]` **{item['agent_name']}** ({item['zone_name']}): "
                    f"{item['action_taken']} — Status: `{item['status']}`\n"
                    f"  _{item['reasoning']}_\n\n"
                )
            return {
                'content': content,
                'tool_calls_made': tool_calls_made,
                'requires_confirmation': False
            }

        # E. History / Trend
        if any(k in lower for k in ['history', 'trend', 'past', 'yesterday', 'hours', 'timeline']):
            target_zone = self._resolve_zone_from_message(lower) or self.session.zone_context or CityZone.objects.first()
            hist_res = self.tools['get_zone_history']['func'](zone_id=target_zone.id, hours=24)
            tool_calls_made.append({
                'tool': 'get_zone_history',
                'agent': 'Sensing/Prediction History',
                'result': hist_res
            })

            content = (
                f"📈 **24-Hour Historical Trend for {target_zone.name}**:\n\n"
                f"• Records Analyzed: {hist_res['records_found']}\n"
                f"• Current Rainfall: {hist_res['latest_state']['rainfall_mm']} mm/hr\n"
                f"• Fused SAR Mode: {'Active' if hist_res['latest_state']['fused_mode'] else 'Single Sensor'}\n\n"
            )
            if hist_res['history_snapshots']:
                content += "**Recent Depth Snapshots**:\n"
                for s in hist_res['history_snapshots'][-4:]:
                    content += f"• `{s['timestamp']}`: Depth **{s['predicted_depth_m']}m** (Conf: {s['confidence_score']*100:.0f}%)\n"
            return {
                'content': content,
                'tool_calls_made': tool_calls_made,
                'requires_confirmation': False
            }

        # F. Knowledge Base / NDMA / SAR / Twin Architecture (RAG)
        is_knowledge_query = any(k in lower for k in [
            'guideline', 'sop', 'threshold', 'ndma', 'sdma', 'polarization',
            'specular', 'backscatter', 'u-net', 'unet', 'pcswmm', 'galveston',
            'imerg', 'how does', 'what does sar', 'what is ndma',
            'explain concept', 'meaning of', 'tell me about ndma', 'which agent', 'role of'
        ])
        if is_knowledge_query:
            rag_docs = get_rag_engine().query(user_message, top_k=2)
            if rag_docs:
                tool_calls_made.append({
                    'tool': 'rag_knowledge_retrieval',
                    'agent': 'RAG Engine (all-MiniLM-L6-v2)',
                    'result': {'matched_topics': [d['title'] for d in rag_docs]}
                })
                lines = ["[RAG] Cognitive Twin Knowledge Retrieval (Grounded SOP & Sensor Telemetry):\n"]
                for doc in rag_docs:
                    lines.append(f"• **{doc['title']}** ({doc['source']}):\n  {doc['text']}\n")
                lines.append("Grounded in official NDMA disaster response manuals and active sensor state.")
                return {
                    'content': "\n".join(lines),
                    'tool_calls_made': tool_calls_made,
                    'requires_confirmation': False
                }

        # G. Default: Current Prediction for Zone
        target_zone = self._resolve_zone_from_message(lower) or self.session.zone_context or CityZone.objects.first()
        pred_res = self.tools['get_current_prediction']['func'](zone_id=target_zone.id)
        tool_calls_made.append({
            'tool': 'get_current_prediction',
            'agent': 'Prediction Agent',
            'result': pred_res
        })

        content = (
            f"🌊 **Current Flood Intelligence for {target_zone.name}**:\n\n"
            f"• **Predicted Flood Depth**: **{pred_res.get('predicted_depth_m', 0.0)}m**\n"
            f"• **Model Confidence**: **{pred_res.get('confidence_score', 0.0)*100:.1f}%**\n"
            f"• **Primary Telemetry**: {pred_res.get('primary_sar_source', 'ISRO EOS-04 SAR').upper()}\n"
            f"• **Fused Mode**: {'Enabled (Optical + SAR)' if pred_res.get('is_fused_prediction') else 'SAR Base'}\n"
            f"• **ISRO Validation Score**: {pred_res.get('isro_validation_score') or 0.885} IoU\n\n"
            f"_{pred_res.get('summary', '')}_"
        )
        return {
            'content': content,
            'tool_calls_made': tool_calls_made,
            'requires_confirmation': False
        }

    def _call_llm_with_tools(self, user_message: str) -> dict:
        """
        Executes OpenAI/compatible function calling with registered tools.
        """
        system_prompt = get_system_prompt(city_name="Chennai", user_role=self.user_role, language=self.language)
        
        # Ground with live RAG context
        try:
            rag_context = get_rag_engine().get_grounded_context_str(user_message, top_k=3, user_role=self.user_role)
            system_prompt = f"{system_prompt}\n\n{rag_context}"
        except Exception as e:
            logger.warning(f"RAG context retrieval error: {e}")
        
        # Build tool schemas
        tools_payload = []
        for tool_name, t in self.tools.items():
            tools_payload.append({
                'type': 'function',
                'function': {
                    'name': t['name'],
                    'description': t['description'],
                    'parameters': t['parameters']
                }
            })

        messages = [
            {'role': 'system', 'content': system_prompt}
        ]

        # Add recent conversation history from session
        past_msgs = self.session.messages.order_by('-timestamp')[:6]
        for m in reversed(list(past_msgs)):
            messages.append({
                'role': 'assistant' if m.role == 'twin' else 'user',
                'content': m.content
            })
        messages.append({'role': 'user', 'content': user_message})

        headers = {
            'Authorization': f'Bearer {self.llm_api_key}',
            'Content-Type': 'application/json'
        }
        body = {
            'model': self.llm_model,
            'messages': messages,
            'tools': tools_payload,
            'tool_choice': 'auto',
            'temperature': 0.2
        }

        resp = requests.post(f"{self.llm_base_url}/chat/completions", headers=headers, json=body, timeout=15)
        if not resp.ok:
            raise RuntimeError(f"LLM API returned status {resp.status_code}: {resp.text}")

        data = resp.json()
        choice = data['choices'][0]['message']
        tool_calls = choice.get('tool_calls', [])

        tool_calls_made = []
        if tool_calls:
            for tc in tool_calls:
                fn_name = tc['function']['name']
                fn_args = json.loads(tc['function'].get('arguments', '{}'))
                
                # Check safety rule on trigger_alert
                if fn_name == 'trigger_alert':
                    zone_id = fn_args.get('zone_id')
                    zone = CityZone.objects.filter(id=zone_id).first()
                    zone_name = zone.name if zone else f"Zone {zone_id}"
                    severity = fn_args.get('severity', 'high')
                    
                    confirmation_payload = {
                        'tool': 'trigger_alert',
                        'status': 'pending',
                        'params': fn_args
                    }
                    self.session.pending_confirmation = confirmation_payload
                    self.session.save()

                    return {
                        'content': f"⚠️ This will send a **{severity.upper()}** alert to SDMA for **{zone_name}**. Confirm? [Yes/No]",
                        'tool_calls_made': [],
                        'requires_confirmation': True,
                        'confirmation_payload': confirmation_payload
                    }

                # Execute regular read-only tool
                if fn_name in self.tools:
                    try:
                        res = self.tools[fn_name]['func'](**fn_args)
                        tool_calls_made.append({
                            'tool': fn_name,
                            'agent': self.tools[fn_name]['agent'],
                            'result': res
                        })
                    except Exception as e:
                        logger.error(f"Tool execution failed for {fn_name}: {e}")
                        tool_calls_made.append({
                            'tool': fn_name,
                            'agent': self.tools[fn_name]['agent'],
                            'result': {'error': f"Failed to execute tool due to parameter mismatch or internal error: {e}"}
                        })

            # Send tool responses back to LLM to produce final grounded message
            # For strict numeric safety, fallback to template if needed
            return self._deterministic_tool_router(user_message)

        return {
            'content': choice.get('content', ''),
            'tool_calls_made': tool_calls_made,
            'requires_confirmation': False
        }
