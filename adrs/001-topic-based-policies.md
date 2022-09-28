# 0001. Strategy to support topic based policies for an organization.

Date: September 28, 2022

## Status

Pending

## Context

Enable the creation and use of multiple GitHub Security Policies that can be applied depending on the "TOPIC" meta-data field or potentially other repository meta-data fields. 
The applicability of a Policy will be dependent upon the Topics which will be applied using Boolean logic such as:
1.	One or more of a defined set of Topics is present
2.	One or more of a defined set of Topics is absent
3.	All Topics in a defined set are all present
4.	All topics in a defined set are absent


## Decision
### There would be a centralized `policy selector` file
For an organization, the policies will be stored in a centralized repo. There could be several policy files and the App will use a selector file to determine which policy files need to be loaded for a repo

```yaml
policies:
- name: critical policy
  path: policies/custom.yml
  selector: 
    topicsIncludesAny: ['rbfcalculatedrating-critical', 'externalfacingapplication-yes']
    topicsExcludesAny: ['mobileapplication-yes']
    topicsIncludesAll: ['rbfcalculatedrating-critical', 'externalfacingapplication-yes']
    topicsExcludesAll: ['mobileapplication-yes']
- name: not so critical policy
  path: policies/low.yml
  selector: 
    topicsIncludesAny: ['rbfcalculatedrating-critical', 'externalfacingapplication-yes']
    topicsExcludesAny: ['mobileapplication-yes']
    topicsIncludesAll: ['rbfcalculatedrating-critical', 'externalfacingapplication-yes']
    topicsExcludesAll: ['mobileapplication-yes']
```

## Open Items
How often will the api to load policies be called? 
- For every webhook event?
    - Will the app scale if there are thousands of events?
        - Will the app run into abuse limits?
            - Yes, but can we prevent it?
                - probot app can handle abuse limits by backing off automatically
        - Will the app run into rate limits
            - Yes, if there are more than 15000 requests per hour
    - Will the app scale when there are 1000s of policy files?
        - Yes, we only load the required policy files not all the files
    - Will this guarantee that the latest policies are loaded every time
        - Yes
    - how will be get the appropriate policies
        - policy selector will be loaded every time
        - filtered policy files will be loaded every time
    - how will be get updates or new files? 
        - files will be loaded everytime
    - How will the app know when the policy file has changed?
        - Not an issue since files will be loaded everytime
            
- Once when the app is started
    - Will the app scale if there are thousands of events?
        - Yes, since the policy is only loaded once
    - Will the app scale when there are 1000s of policy files?
        - Yes, since the policy is only loaded once
    - Will this guarantee that the latest policies are loaded every time
        - No
    - how will be get the appropriate policies
        - all policies are stored in a singleton map
        - policy selector is stored as a singleton
    - how will we get updates or new files? 
        - restart the app 
    - How will the app know when the policy file has changed?
        - App will not know, there has to be a restart

- Once when the app is loaded and whenever the policy files change
    - Will the app scale if there are thousands of events?
        - Yes, the policy file is loaded once and reloaded only when there is a change
    - Will the app scale when there are 1000s of policy files?
        - Yes, we only load the required policy files not all the files
    - Will this guarantee that the latest policies are loaded every time
        - No
    - how will we get the appropriate policies
        - all policies are stored in a singleton map
        - policy selector is stored as a singleton
    - how will be get updates or new files? 
        - restart the app 
    - How will the app know when the policy file has changed?
        - App will not know, there has to be a restart
  - How will the app know when the policy file has changed?
    - push event?
        - can the GHAS compliance listen to push events and ignore if it is not policy file changes?
          - How will ghas compliance app know what is a policy file?
            - based on the repo name
              - how will the app know what is a policy repo?
                - from the runtime settings

What if mutiple policies match?
- apply the first one
    - What happens if there are more than one policy for a repo?
        - First one is applied
    - Is there a sequence to follow?
        - Order matters
- apply all of them sequentially
    - What happens if there are more than one policy for a repo?
        - all of them are applied
    - Is there a sequence to follow?
        - Order does not matter
- deep merge all the matched policy objects
    - What happens if there are more than one policy for a repo?
        - all of them are applied
    - Is there a sequence to follow?
        - Order does not matter
            
## Consequences
## Discarded solutions

<If other solutions were considered those should be mentioned here including why those were discarded.
It is important to show due diligence. If no other solutions were considered, add a reason why in this section.>