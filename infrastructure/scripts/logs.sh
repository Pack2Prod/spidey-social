#!/usr/bin/env bash
# Tail CreateWeb Lambda logs (escape * for zsh)
FN=$(aws lambda list-functions --query "Functions[?contains(FunctionName,'CreateWeb')].FunctionName" --output text)
aws logs tail "/aws/lambda/$FN" --follow --since 5m
